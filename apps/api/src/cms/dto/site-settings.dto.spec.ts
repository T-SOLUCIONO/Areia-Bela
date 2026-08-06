// Los decoradores de class-validator lo necesitan, y un test de DTO puro no
// carga `main.ts`, que es donde se importa en la aplicación.
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateSiteSettingsDto } from './cms.dto'

/**
 * The settings form, validated against what the panel actually sends.
 *
 * The API runs `forbidNonWhitelisted`, so a field missing from this DTO is not
 * ignored — it is a 400 that names it. Three columns were added to the schema,
 * the panel and the service without being added here, and the whole form
 * stopped saving with a message about properties nobody had typed.
 */
const payload = {
  contactEmail: 'host@areiabela.com',
  contactPhone: '+1 (727) 555-3043',
  whatsapp: '18605497679',
  seoTitle: 'Areia Bela — Casa completa con piscina climatizada',
  seoDescription: 'Casa de 3 dormitorios a 5 minutos de Madeira Beach.',
  instagramUrl: null,
  facebookUrl: null,
  airbnbUrl: null,
  logoUrl: null,
  notifyEmail: 'egiraldom@outlook.com',
  notifyWhatsapp: '',
  notifyTelegram: '691691881',
  whatsappProvider: 'META',
  notifyOnBooking: true,
  notifyOnCancel: true,
  notifyOnChange: true,
  notifyOnMessage: true,
}

/** The names class-validator complained about, for readable failures. */
const failures = async (body: Record<string, unknown>) => {
  const errors = await validate(plainToInstance(UpdateSiteSettingsDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  })
  return errors.map((error) => error.property)
}

describe('UpdateSiteSettingsDto', () => {
  it('accepts everything the panel sends', async () => {
    expect(await failures(payload)).toEqual([])
  })

  it('accepts either WhatsApp provider', async () => {
    expect(await failures({ ...payload, whatsappProvider: 'TWILIO' })).toEqual([])
  })

  it('refuses a provider that is not one of the two', async () => {
    // The value goes straight into a Prisma enum column, so without this it is
    // a 500 from the database instead of a 400 naming the field.
    expect(await failures({ ...payload, whatsappProvider: 'SIGNAL' })).toEqual(['whatsappProvider'])
  })

  it('refuses the fields the server owns', async () => {
    // `id` and `updatedAt` come back on every read, and the panel used to send
    // the whole row straight back. That is why saving never worked.
    expect(
      await failures({ ...payload, id: 'site', updatedAt: '2026-08-06T03:48:48.646Z' }),
    ).toEqual(['id', 'updatedAt'])
  })

  it('lets a host clear an optional field rather than requiring a value', async () => {
    // Empty means "fall back to the public one", which is a choice the form has
    // to be able to express.
    expect(await failures({ ...payload, notifyEmail: '', notifyTelegram: '' })).toEqual([])
  })
})
