import { createHash, randomBytes } from 'node:crypto'
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import {
  GUEST_LOGIN_TTL_MINUTES,
  GUEST_SESSION_TTL_SECONDS,
  GUEST_TOKEN_AUDIENCE,
} from '@areia-bela/shared'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'

export interface GuestIdentity {
  customerId: string
  email: string
  name: string
}

/** Hashed the same way as every other emailed secret in this codebase. */
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

@Injectable()
export class GuestAuthService {
  private readonly logger = new Logger(GuestAuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  /**
   * Emails a sign-in link, if that address has ever booked.
   *
   * Always resolves, and the caller always answers 204. Saying "no account
   * with that email" would turn this into a way to ask the house whether a
   * given person has stayed here — which is exactly the kind of thing a guest
   * would not expect a booking site to tell a stranger.
   */
  async requestLink(email: string, locale: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { _count: { select: { bookings: true } } },
    })

    if (!customer || customer._count.bookings === 0) {
      this.logger.log(`Guest link requested for an address with no bookings: ${email}`)
      return
    }

    // One live link at a time: requesting a new one should invalidate the old,
    // or an old email left in an inbox stays a working key.
    await this.prisma.guestLoginToken.deleteMany({
      where: { customerId: customer.id, usedAt: null },
    })

    const token = randomBytes(32).toString('hex')
    await this.prisma.guestLoginToken.create({
      data: {
        customerId: customer.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + GUEST_LOGIN_TTL_MINUTES * 60_000),
      },
    })

    const base = this.config.get<string>('PUBLIC_SITE_URL') ?? 'http://localhost:3000'
    const link = `${base}/${locale}/my-booking/enter?token=${token}`
    const copy = LINK_COPY[locale] ?? LINK_COPY.en

    try {
      await this.mail.send({
        to: customer.email,
        toName: `${customer.firstName} ${customer.lastName}`,
        subject: copy.subject,
        text: [copy.greeting(customer.firstName), '', link, '', copy.expiry, copy.ignore].join(
          '\n',
        ),
        html: [
          `<p>${copy.greeting(customer.firstName)}</p>`,
          `<p><a href="${link}">${copy.button}</a></p>`,
          `<p>${copy.expiry}<br>${copy.ignore}</p>`,
        ].join(''),
      })
    } catch (error) {
      // Logged, never thrown: the endpoint answers the same either way, and a
      // different response here would leak whether the address exists.
      this.logger.error(
        `Could not email a guest link: ${error instanceof Error ? error.message : 'unknown'}`,
      )
    }
  }

  /**
   * Spends a link and returns who it belongs to.
   *
   * Single use, so a link forwarded or left in an inbox stops working the
   * moment it is followed.
   */
  async redeem(token: string): Promise<GuestIdentity> {
    const record = await this.prisma.guestLoginToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { customer: true },
    })

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('That link is no longer valid')
    }

    await this.prisma.guestLoginToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })

    return {
      customerId: record.customer.id,
      email: record.customer.email,
      name: `${record.customer.firstName} ${record.customer.lastName}`,
    }
  }

  /**
   * The session cookie's contents.
   *
   * `aud` is what stops this ever being accepted as a staff token: the admin
   * guard verifies without an audience and would otherwise take any token
   * signed with the same secret.
   */
  signSession(identity: GuestIdentity): string {
    return this.jwt.sign(
      { sub: identity.customerId, email: identity.email },
      {
        audience: GUEST_TOKEN_AUDIENCE,
        expiresIn: GUEST_SESSION_TTL_SECONDS,
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      },
    )
  }

  verifySession(token: string): { customerId: string; email: string } {
    try {
      const payload = this.jwt.verify<{ sub: string; email: string }>(token, {
        audience: GUEST_TOKEN_AUDIENCE,
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      })
      return { customerId: payload.sub, email: payload.email }
    } catch {
      throw new UnauthorizedException('Session expired')
    }
  }
}

/**
 * The sign-in email, in the five languages the site speaks.
 *
 * Plain and short on purpose: a link email that reads like marketing is a link
 * email that gets filtered.
 */
const LINK_COPY: Record<
  string,
  {
    subject: string
    greeting: (name: string) => string
    button: string
    expiry: string
    ignore: string
  }
> = {
  es: {
    subject: 'Entra a tu reserva · Areia Bela',
    greeting: (name) => `Hola ${name}, aquí tienes tu enlace para entrar:`,
    button: 'Ver mi reserva',
    expiry: 'El enlace vale por una hora y se usa una sola vez.',
    ignore: 'Si no lo pediste, puedes ignorar este correo.',
  },
  en: {
    subject: 'Sign in to your booking · Areia Bela',
    greeting: (name) => `Hi ${name}, here is your sign-in link:`,
    button: 'View my booking',
    expiry: 'The link is good for an hour and works once.',
    ignore: 'If you did not ask for it, you can ignore this email.',
  },
  pt: {
    subject: 'Acesse a sua reserva · Areia Bela',
    greeting: (name) => `Olá ${name}, aqui está o seu link de acesso:`,
    button: 'Ver a minha reserva',
    expiry: 'O link vale por uma hora e funciona uma única vez.',
    ignore: 'Se você não solicitou, pode ignorar este e-mail.',
  },
  fr: {
    subject: 'Accédez à votre réservation · Areia Bela',
    greeting: (name) => `Bonjour ${name}, voici votre lien de connexion :`,
    button: 'Voir ma réservation',
    expiry: 'Le lien est valable une heure et ne fonctionne qu’une fois.',
    ignore: 'Si vous ne l’avez pas demandé, ignorez cet e-mail.',
  },
  de: {
    subject: 'Zu Ihrer Buchung · Areia Bela',
    greeting: (name) => `Hallo ${name}, hier ist Ihr Anmeldelink:`,
    button: 'Meine Buchung ansehen',
    expiry: 'Der Link gilt eine Stunde und funktioniert einmal.',
    ignore: 'Falls Sie ihn nicht angefordert haben, ignorieren Sie diese E-Mail.',
  },
}
