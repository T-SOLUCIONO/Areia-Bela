import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * Sonnet rather than Opus: these are short marketing strings, and the cheaper,
 * faster model is more than capable. Translation quality is not the bottleneck.
 */
const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 2048

const LANGUAGE_NAME = { es: 'Spanish', en: 'English' } as const

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>
  error?: { message?: string }
}

/**
 * Machine translation for the admin's "translate" button.
 *
 * Deliberately a suggestion, never an automatic save: CLAUDE.md forbids
 * inventing translations, and copy that reaches guests without a human reading
 * it is exactly that. The endpoint returns text; the host decides whether to
 * keep it. See docs/changelog.md.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name)

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY'))
  }

  async translate(text: string, from: 'es' | 'en', to: 'es' | 'en'): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY')
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Translation is not configured. Set ANTHROPIC_API_KEY (see docs/env.md).',
      )
    }
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
        // add commentary, because anything it says lands straight in an input.
        system:
          `You translate website copy for Areia Bela, a single whole-home ` +
          `vacation rental near Madeira Beach, Florida. It is a house, not a ` +
          `hotel: never use hotel vocabulary such as rooms, suites or front ` +
          `desk. Translate from ${LANGUAGE_NAME[from]} to ${LANGUAGE_NAME[to]}, ` +
          `keeping the warm, plain tone and any line breaks. Keep proper nouns, ` +
          `prices, and place names as they are. Reply with the translation ` +
          `alone — no quotes, no notes, no explanation.`,
        messages: [{ role: 'user', content: text }],
      }),
    })

    const body = (await response.json().catch(() => null)) as AnthropicResponse | null

    if (!response.ok) {
      const detail = body?.error?.message ?? response.statusText
      this.logger.warn(`Translation failed (${response.status}): ${detail}`)
      throw new ServiceUnavailableException(`Translation failed: ${detail}`)
    }

    const translated = body?.content?.find((part) => part.type === 'text')?.text?.trim()
    if (!translated) {
      throw new ServiceUnavailableException('Translation returned nothing')
    }

    return translated
  }
}
