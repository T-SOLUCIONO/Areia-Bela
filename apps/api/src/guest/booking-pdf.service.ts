import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import PDFDocument from 'pdfkit'
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
    const statuses = copy === COPY.es ? STATUS_ES : STATUS_EN

    // `address` is already the full line the host typed — "San Petersburgo,
    // Florida, Estados Unidos". Appending city, state and country to it
    // printed the place twice.
    const property = await this.prisma.property.findFirst({ select: { address: true } })

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
    value(booking.checkIn, left, y + 13)
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(booking.checkInTime, left, y + 32)

    heading(copy.departure, left + half, y)
    value(booking.checkOut, left + half, y + 13)
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

    // --- Total ------------------------------------------------------------
    doc.roundedRect(left, y, right - left, 56, 8).fill(CREAM)
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(BLUE)
      .text(copy.total, left + 20, y + 21)
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor(INK)
      .text(`$${booking.total.toLocaleString('en-US')}`, left + 20, y + 16, {
        width: right - left - 40,
        align: 'right',
      })

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
