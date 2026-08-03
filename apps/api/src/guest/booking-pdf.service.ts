import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import {
  fullRefundDeadline,
  guestReadyAccessNotes,
  halfRefundDeadline,
  type CancellationPolicy,
} from '@areia-bela/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { MyBooking } from './guest.service'

/** The house's colours, so the document is recognisably from this site. */
const INK = '#173a57'
const BLUE = '#174d7a'
const CREAM = '#f7f2ea'
const MUTED = '#6b7280'

/** Where the logo lives in the repo. Absent in some deploys, so it is optional. */
const LOGO_PATH = join(process.cwd(), '..', 'web', 'public', 'areia-bela-logo.png')

interface PdfCopy {
  title: string
  reference: string
  arrival: string
  departure: string
  nights: string
  guests: string
  pets: string
  extras: string
  note: string
  total: string
  status: string
  guest: string
  contact: string
  footer: string
  bill: string
  billNights: string
  billDiscount: string
  billExtras: string
  billGuestFee: string
  billCleaning: string
  billService: string
  billTaxes: string
  policy: string
  policyNote: string
  address: string
  access: string
  rules: string
  trash: string
}

const COPY: Record<string, PdfCopy> = {
  es: {
    title: 'Confirmación de reserva',
    reference: 'Referencia',
    arrival: 'Llegada',
    departure: 'Salida',
    nights: 'Noches',
    guests: 'Huéspedes',
    pets: 'Mascotas',
    extras: 'Extras',
    note: 'Nota del huésped',
    total: 'Total pagado',
    status: 'Estado',
    guest: 'A nombre de',
    contact: 'Contacto',
    footer: 'Areia Bela · casa completa en St. Petersburg, Florida',
    bill: 'Detalle del precio',
    billNights: 'Noches',
    billDiscount: 'Descuento por estadía larga',
    billExtras: 'Extras',
    billGuestFee: 'Huéspedes adicionales',
    billCleaning: 'Limpieza',
    billService: 'Tarifa de servicio',
    billTaxes: 'Impuestos',
    policy: 'Política de cancelación',
    policyNote: 'El reembolso lo procesa la anfitriona directamente en Stripe.',
    address: 'Dirección',
    access: 'Cómo entrar',
    rules: 'Reglas de la casa',
    trash: 'Día de basura',
  },
  en: {
    title: 'Booking confirmation',
    reference: 'Reference',
    arrival: 'Check-in',
    departure: 'Check-out',
    nights: 'Nights',
    guests: 'Guests',
    pets: 'Pets',
    extras: 'Extras',
    note: 'Guest note',
    total: 'Total paid',
    status: 'Status',
    guest: 'Booked by',
    contact: 'Contact',
    footer: 'Areia Bela · whole house in St. Petersburg, Florida',
    bill: 'Price details',
    billNights: 'Nights',
    billDiscount: 'Long-stay discount',
    billExtras: 'Extras',
    billGuestFee: 'Additional guests',
    billCleaning: 'Cleaning',
    billService: 'Service fee',
    billTaxes: 'Taxes',
    policy: 'Cancellation policy',
    policyNote: 'Refunds are processed by the host directly in Stripe.',
    address: 'Address',
    access: 'Getting in',
    rules: 'House rules',
    trash: 'Bin day',
  },
}

const STATUS_ES: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  PENDING: 'Esperando el pago',
  CANCELLED: 'Cancelada',
  CHECKED_IN: 'En la casa',
  CHECKED_OUT: 'Completada',
}
const STATUS_EN: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  PENDING: 'Awaiting payment',
  CANCELLED: 'Cancelled',
  CHECKED_IN: 'Checked in',
  CHECKED_OUT: 'Completed',
}

/** Weekday keys as stored, spelled out. "wednesday" on a receipt is sloppy. */
const WEEKDAYS: Record<string, { es: string; en: string }> = {
  monday: { es: 'lunes', en: 'Monday' },
  tuesday: { es: 'martes', en: 'Tuesday' },
  wednesday: { es: 'miércoles', en: 'Wednesday' },
  thursday: { es: 'jueves', en: 'Thursday' },
  friday: { es: 'viernes', en: 'Friday' },
  saturday: { es: 'sábado', en: 'Saturday' },
  sunday: { es: 'domingo', en: 'Sunday' },
}

const MONTHS = {
  es: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
}

/**
 * "2026-07-31" as "31 de julio de 2026".
 *
 * Written out rather than left as ISO: a guest reads this document, and a
 * receipt full of hyphenated numbers reads like a database export.
 */
function longDate(iso: string, locale: 'es' | 'en'): string {
  const [year, month, day] = iso.split('-').map(Number)
  const name = MONTHS[locale][month - 1]
  return locale === 'es' ? `${day} de ${name} de ${year}` : `${name} ${day}, ${year}`
}

/**
 * The cancellation policy in prose, for the two languages the PDF speaks.
 *
 * The rules live in `@areia-bela/shared` so the site and this document decide
 * refunds from the same numbers; only the wording is duplicated here, and only
 * because a PDF has no translation layer to reach into.
 */
function describePolicy(policy: CancellationPolicy, checkIn: string, locale: 'es' | 'en'): string {
  const full = fullRefundDeadline(checkIn, policy)
  const half = halfRefundDeadline(checkIn, policy)
  const day = (value: string | null) => (value ? longDate(value, locale) : '')

  if (locale === 'es') {
    return {
      FLEXIBLE: 'Reembolso completo si cancelas hasta 24 horas antes de la llegada.',
      MODERATE: `Reembolso completo si cancelas antes del ${day(full)}, cinco días antes de tu llegada.`,
      FIRM: `Reembolso completo hasta el ${day(full)}. Después, 50 % hasta el ${day(half)}.`,
      STRICT: `Reembolso completo si cancelas en las 48 horas siguientes a reservar y faltan más de 14 días. Después, 50 % hasta el ${day(half)}.`,
    }[policy]
  }

  return {
    FLEXIBLE: 'Full refund if you cancel up to 24 hours before check-in.',
    MODERATE: `Full refund if you cancel before ${day(full)}, five days before you arrive.`,
    FIRM: `Full refund until ${day(full)}. After that, 50% until ${day(half)}.`,
    STRICT: `Full refund if you cancel within 48 hours of booking and check-in is more than 14 days away. After that, 50% until ${day(half)}.`,
  }[policy]
}

/**
 * The booking as a document the guest can keep, print, or show at a border.
 *
 * Built server-side rather than in the browser so the same bytes come out
 * whoever asks and whatever they are running — and because the figures on it
 * are the stored ones, not something a page recomputed.
 *
 * Only Spanish and English: a PDF is a legal-ish artefact people forward to
 * third parties, and a machine-translated one is worse than one in a language
 * they can at least recognise. The five-language site is a separate promise.
 */
@Injectable()
export class BookingPdfService {
  private readonly logger = new Logger(BookingPdfService.name)

  constructor(private readonly prisma: PrismaService) {}

  async render(booking: MyBooking, guestName: string, guestEmail: string, locale: string) {
    const copy = COPY[locale] ?? COPY.en
    const lang: 'es' | 'en' = locale === 'es' ? 'es' : 'en'
    const statuses = lang === 'es' ? STATUS_ES : STATUS_EN

    // `address` is already the full line the host typed — "San Petersburgo,
    // Florida, Estados Unidos". Appending city, state and country to it
    // printed the place twice.
    const property = await this.prisma.property.findFirst({
      select: {
        address: true,
        accessNotes: true,
        trashCollectionDays: true,
        cancellationPolicy: true,
      },
    })

    // The rules the host wrote, not a set invented here. Absent blocks are
    // simply not printed.
    const rulesPage = await this.prisma.cMSPage.findFirst({
      where: { slug: 'HOUSE_RULES', published: true },
      select: { body: true },
    })
    const houseRules = rulesPage?.body?.trim() ?? ''

    const policy = property?.cancellationPolicy ?? 'MODERATE'
    const policyText = describePolicy(policy, booking.checkIn, lang)

    const doc = new PDFDocument({ size: 'A4', margin: 56 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    const { width } = doc.page
    const left = 56
    const right = width - 56

    // --- Masthead ---------------------------------------------------------
    if (existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, left, 48, { height: 34 })
      } catch (error) {
        this.logger.warn(`Could not draw the logo: ${String(error)}`)
      }
    } else {
      doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text('Areia Bela', left, 52)
    }

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(copy.title.toUpperCase(), left, 56, { width: right - left, align: 'right' })

    doc.moveTo(left, 100).lineTo(right, 100).lineWidth(0.5).strokeColor(BLUE).stroke()

    // --- The reference, given the weight it deserves ----------------------
    doc.roundedRect(left, 120, right - left, 76, 8).fill(CREAM)
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(BLUE)
      .text(copy.reference.toUpperCase(), left + 20, 138, { characterSpacing: 1 })
    doc
      .font('Courier-Bold')
      .fontSize(26)
      .fillColor(INK)
      .text(booking.reference, left + 20, 152, { characterSpacing: 2 })
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(statuses[booking.status] ?? booking.status, left + 20, 152, {
        width: right - left - 40,
        align: 'right',
      })

    // --- The stay ---------------------------------------------------------
    let y = 230
    const half = (right - left) / 2

    const heading = (label: string, x: number, top: number) =>
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x, top, {
        characterSpacing: 1,
      })
    const value = (text: string, x: number, top: number, size = 14) =>
      doc.font('Helvetica-Bold').fontSize(size).fillColor(INK).text(text, x, top)

    heading(copy.arrival, left, y)
    value(longDate(booking.checkIn, lang), left, y + 13, 13)
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(booking.checkInTime, left, y + 32)

    heading(copy.departure, left + half, y)
    value(longDate(booking.checkOut, lang), left + half, y + 13, 13)
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(booking.checkOutTime, left + half, y + 32)

    y += 62
    const facts: Array<[string, string]> = [
      [copy.nights, String(booking.nights)],
      [copy.guests, String(booking.guests)],
    ]
    if (booking.pets > 0) facts.push([copy.pets, String(booking.pets)])

    facts.forEach(([label, text], index) => {
      const x = left + index * ((right - left) / facts.length)
      heading(label, x, y)
      value(text, x, y + 13, 13)
    })

    y += 52
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke()
    y += 20

    heading(copy.guest, left, y)
    value(guestName, left, y + 13, 12)
    heading(copy.contact, left + half, y)
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(INK)
      .text(guestEmail, left + half, y + 13)
    y += 48

    if (booking.extras.length > 0) {
      heading(copy.extras, left, y)
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(INK)
        .text(booking.extras.join(' · '), left, y + 13, { width: right - left })
      y += 44
    }

    if (booking.specialRequests) {
      heading(copy.note, left, y)
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(INK)
        .text(booking.specialRequests, left, y + 13, { width: right - left })
      y = doc.y + 18
    }

    // --- The bill, line by line -------------------------------------------
    // Read off the booking as charged, not recomputed: a receipt that restates
    // last season's stay at this season's prices is not a receipt.
    heading(copy.bill, left, y)
    y += 18

    const money = (amount: number) => `$${amount.toLocaleString('en-US')}`

    // Same guard as the web: a receipt whose lines do not add up to the amount
    // charged is worse than one that only states the amount. Bookings taken
    // before the breakdown was stored have zeros here.
    const sum =
      booking.bill.nightsSubtotal -
      booking.bill.weeklyDiscount +
      booking.bill.extrasTotal +
      booking.bill.additionalGuestFee +
      booking.bill.cleaningFee +
      booking.bill.serviceFee +
      booking.bill.taxes
    const reconciles = Math.abs(sum - booking.bill.total) < 0.02

    const lines: Array<[string, string]> = reconciles
      ? [[`${copy.billNights} · ${booking.nights}`, money(booking.bill.nightsSubtotal)]]
      : []
    if (reconciles && booking.bill.weeklyDiscount > 0) {
      lines.push([copy.billDiscount, `−${money(booking.bill.weeklyDiscount)}`])
    }
    if (reconciles && booking.bill.additionalGuestFee > 0) {
      lines.push([copy.billGuestFee, money(booking.bill.additionalGuestFee)])
    }
    if (reconciles && booking.bill.extrasTotal > 0) {
      lines.push([copy.billExtras, money(booking.bill.extrasTotal)])
    }
    if (booking.bill.cleaningFee > 0)
      lines.push([copy.billCleaning, money(booking.bill.cleaningFee)])
    if (reconciles && booking.bill.serviceFee > 0) {
      lines.push([copy.billService, money(booking.bill.serviceFee)])
    }
    if (reconciles && booking.bill.taxes > 0) {
      lines.push([copy.billTaxes, money(booking.bill.taxes)])
    }

    lines.forEach(([label, amount]) => {
      doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(label, left, y)
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(INK)
        .text(amount, left, y, { width: right - left, align: 'right' })
      y += 17
    })

    y += 4
    doc.roundedRect(left, y, right - left, 50, 8).fill(CREAM)
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(BLUE)
      .text(copy.total, left + 20, y + 19)
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(INK)
      .text(money(booking.bill.total), left + 20, y + 15, {
        width: right - left - 40,
        align: 'right',
      })
    y += 70

    // --- What they need before arriving ------------------------------------
    const block = (label: string, body: string) => {
      if (!body) return
      if (y > doc.page.height - 150) {
        doc.addPage()
        y = 56
      }
      heading(label, left, y)
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(INK)
        .text(body, left, y + 14, { width: right - left })
      y = doc.y + 16
    }

    block(copy.policy, `${policyText}\n${copy.policyNote}`)
    block(copy.address, property?.address ?? '')
    // `block` skips an empty body, so a template simply leaves no section
    // rather than printing a heading over a row of brackets.
    block(copy.access, guestReadyAccessNotes(property?.accessNotes) ?? '')
    block(
      copy.trash,
      (property?.trashCollectionDays ?? [])
        .map((day) => WEEKDAYS[day.toLowerCase()]?.[lang] ?? day)
        .join(', '),
    )
    block(copy.rules, houseRules ?? '')

    // --- Footer -----------------------------------------------------------
    const address = property?.address ?? ''
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(`${copy.footer}${address ? `\n${address}` : ''}`, left, doc.page.height - 78, {
        width: right - left,
        align: 'center',
      })

    doc.end()
    return done
  }
}
