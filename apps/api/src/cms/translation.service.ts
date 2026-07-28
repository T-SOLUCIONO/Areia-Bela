import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from '@areia-bela/shared'
import { PrismaService } from '../prisma/prisma.service'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * Sonnet rather than Opus: these are short strings of website copy, and the
 * cheaper, faster model is more than capable. Translation quality is not the
 * bottleneck; having a key configured is.
 */
const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 4096

const LANGUAGE_NAME: Record<SupportedLocale, string> = {
  es: 'Spanish',
  en: 'English',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
}

/** Locales that need a Translation row. The source language is not one. */
export const TARGET_LOCALES = SUPPORTED_LOCALES.filter(
  (locale): locale is SupportedLocale => locale !== DEFAULT_LOCALE,
)

export const hashSource = (text: string) => createHash('sha256').update(text).digest('hex')

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>
  error?: { message?: string }
}

/**
 * Machine translation of the site's content.
 *
 * The host writes once, in DEFAULT_LOCALE. Everything else is generated here
 * and stored, so the guest site never waits on a model: it reads a row.
 *
 * Two rules keep this from going wrong quietly:
 * - Every stored translation records a hash of the source it came from. Edit
 *   the source and the translation is stale, not silently wrong.
 * - A translation a human has edited (`isMachine: false`) is never overwritten.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY'))
  }

  /**
   * Fetches every translation for a set of records in one query, keyed for
   * lookup. One query per request rather than one per field.
   */
  async load(entity: string, ids: string[], locale: string) {
    if (!isSupportedLocale(locale) || locale === DEFAULT_LOCALE || ids.length === 0) {
      return new Map<string, { text: string; sourceHash: string }>()
    }

    const rows = await this.prisma.translation.findMany({
      where: { entity, entityId: { in: ids }, locale },
      select: { entityId: true, field: true, text: true, sourceHash: true },
    })

    return new Map(
      rows.map((row) => [
        `${row.entityId}:${row.field}`,
        { text: row.text, sourceHash: row.sourceHash },
      ]),
    )
  }

  /**
   * Replaces a record's translatable fields with the requested language.
   *
   * Falls back to the source text when a field has no translation or when the
   * source has changed since it was made. Silently showing a translation of
   * text that no longer exists is the failure this prevents.
   */
  localize<T extends { id: string }>(
    record: T,
    fields: readonly (keyof T & string)[],
    translations: Map<string, { text: string; sourceHash: string }>,
  ): T {
    const localized = { ...record }

    for (const field of fields) {
      const source = record[field]
      if (typeof source !== 'string' || !source.trim()) continue

      const hit = translations.get(`${record.id}:${field}`)
      if (hit && hit.sourceHash === hashSource(source)) {
        localized[field] = hit.text as T[keyof T & string]
      }
    }

    return localized
  }

  /**
   * Translates a record's fields into every other language and stores them.
   *
   * Called after a save. Failures are logged, not thrown: a translation
   * service being down must not stop the host from saving their own words.
   */
  async syncRecord(
    entity: string,
    record: { id: string } & Record<string, unknown>,
    fields: readonly string[],
  ): Promise<void> {
    if (!this.isConfigured) return

    for (const field of fields) {
      const source = record[field]
      if (typeof source !== 'string' || !source.trim()) continue

      const sourceHash = hashSource(source)

      for (const locale of TARGET_LOCALES) {
        const existing = await this.prisma.translation.findUnique({
          where: {
            entity_entityId_field_locale: { entity, entityId: record.id, field, locale },
          },
        })

        // Up to date, or edited by a person: leave it alone.
        if (existing && (existing.sourceHash === sourceHash || !existing.isMachine)) continue

        try {
          const text = await this.translate(source, DEFAULT_LOCALE, locale)
          await this.prisma.translation.upsert({
            where: {
              entity_entityId_field_locale: { entity, entityId: record.id, field, locale },
            },
            update: { text, sourceHash, isMachine: true },
            create: { entity, entityId: record.id, field, locale, text, sourceHash },
          })
        } catch (error) {
          this.logger.warn(
            `Could not translate ${entity}.${field} (${record.id}) to ${locale}: ${(error as Error).message}`,
          )
        }
      }
    }
  }

  /** Drops the rows belonging to a record that no longer exists. */
  async forget(entity: string, entityId: string): Promise<void> {
    await this.prisma.translation.deleteMany({ where: { entity, entityId } })
  }

  async translate(text: string, from: SupportedLocale, to: SupportedLocale): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    if (from === to) return text

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // The house's own voice, not a literal gloss. Told explicitly not to
        // add commentary, because whatever it says goes straight on the page.
        system:
          `You translate website copy for Areia Bela, a single whole-home ` +
          `vacation rental near Madeira Beach, Florida. It is a house, not a ` +
          `hotel: never use hotel vocabulary such as rooms, suites or front ` +
          `desk. Translate from ${LANGUAGE_NAME[from]} to ${LANGUAGE_NAME[to]}, ` +
          `keeping the warm, plain tone and any line breaks. Keep proper nouns, ` +
          `prices and place names as they are. Reply with the translation ` +
          `alone — no quotes, no notes, no explanation.`,
        messages: [{ role: 'user', content: text }],
      }),
    })

    const body = (await response.json().catch(() => null)) as AnthropicResponse | null

    if (!response.ok) {
      throw new Error(body?.error?.message ?? response.statusText)
    }

    const translated = body?.content?.find((part) => part.type === 'text')?.text?.trim()
    if (!translated) throw new Error('Translation returned nothing')

    return translated
  }
}
