import type { SupportedLocale } from '@areia-bela/shared'

/**
 * Where translations come from. Three implementations, chosen by which one is
 * configured, so switching provider is an environment variable rather than a
 * code change.
 */
export interface TranslationProvider {
  readonly name: string
  translate(text: string, from: SupportedLocale, to: SupportedLocale): Promise<string>
}

// --- DeepL -------------------------------------------------------------------

/**
 * Region matters for two of these. DeepL deprecated bare `EN` as a target and
 * wants a variant; the house is in Florida, so `EN-US`. Portuguese speakers
 * travelling to Florida are overwhelmingly Brazilian, hence `PT-BR` — change
 * it here if that assumption stops holding.
 */
const DEEPL_TARGET: Record<SupportedLocale, string> = {
  es: 'ES',
  en: 'EN-US',
  pt: 'PT-BR',
  fr: 'FR',
  de: 'DE',
}

const DEEPL_SOURCE: Record<SupportedLocale, string> = {
  es: 'ES',
  en: 'EN',
  pt: 'PT',
  fr: 'FR',
  de: 'DE',
}

interface DeepLResponse {
  translations?: Array<{ text: string }>
  message?: string
}

/**
 * DeepL, free tier: 500,000 characters a month at no cost, indefinitely.
 *
 * Best quality of the three for exactly these languages, which are DeepL's
 * strength. The trade against Claude is that there is no system prompt, so it
 * cannot be told "this is a house, not a hotel" — it translates literally.
 * `formality: prefer_less` keeps it from turning warm copy into corporate
 * German or French, which is the failure that would show up first.
 */
export class DeepLProvider implements TranslationProvider {
  readonly name = 'DeepL'

  constructor(private readonly apiKey: string) {}

  /** Free keys end in `:fx` and live on a different host than paid ones. */
  private get endpoint(): string {
    const host = this.apiKey.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com'
    return `https://${host}/v2/translate`
  }

  async translate(text: string, from: SupportedLocale, to: SupportedLocale): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
      },
      body: JSON.stringify({
        text: [text],
        source_lang: DEEPL_SOURCE[from],
        target_lang: DEEPL_TARGET[to],
        formality: 'prefer_less',
        // Keeps line breaks, which several of these fields rely on.
        preserve_formatting: true,
      }),
    })

    const body = (await response.json().catch(() => null)) as DeepLResponse | null

    if (!response.ok) {
      // 456 is DeepL's "quota exhausted" — worth naming, because the fix is
      // waiting for the month to roll over, not debugging.
      const detail =
        response.status === 456
          ? 'monthly character quota exhausted'
          : (body?.message ?? response.statusText)
      throw new Error(`DeepL: ${detail}`)
    }

    const translated = body?.translations?.[0]?.text?.trim()
    if (!translated) throw new Error('DeepL returned nothing')

    return translated
  }
}

// --- LibreTranslate ----------------------------------------------------------

interface LibreResponse {
  translatedText?: string
  error?: string
}

/**
 * LibreTranslate: open source, self-hostable, free with no account at all.
 *
 * The escape hatch for not sending the site's copy to a third party — run it
 * with `docker run -p 5000:5000 libretranslate/libretranslate` and point
 * LIBRETRANSLATE_URL at it. Quality is a clear step below DeepL; fine for
 * amenity labels, weaker on the host's warmer paragraphs.
 */
export class LibreTranslateProvider implements TranslationProvider {
  readonly name = 'LibreTranslate'

  constructor(
    private readonly url: string,
    private readonly apiKey?: string,
  ) {}

  async translate(text: string, from: SupportedLocale, to: SupportedLocale): Promise<string> {
    const response = await fetch(`${this.url.replace(/\/$/, '')}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: from,
        target: to,
        format: 'text',
        ...(this.apiKey ? { api_key: this.apiKey } : {}),
      }),
    })

    const body = (await response.json().catch(() => null)) as LibreResponse | null

    if (!response.ok) throw new Error(`LibreTranslate: ${body?.error ?? response.statusText}`)
    if (!body?.translatedText) throw new Error('LibreTranslate returned nothing')

    return body.translatedText.trim()
  }
}

// --- Claude ------------------------------------------------------------------

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/** Short strings of website copy: the fast, cheap model is more than enough. */
const ANTHROPIC_MODEL = 'claude-sonnet-5'

const LANGUAGE_NAME: Record<SupportedLocale, string> = {
  es: 'Spanish',
  en: 'English',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>
  error?: { message?: string }
}

/**
 * Claude. Paid, but the only one of the three that can be told what it is
 * translating: that this is a house and not a hotel, and that the tone is warm
 * and plain. Worth it for the host's own paragraphs and the guest reviews.
 */
export class ClaudeProvider implements TranslationProvider {
  readonly name = 'Claude'

  constructor(private readonly apiKey: string) {}

  async translate(text: string, from: SupportedLocale, to: SupportedLocale): Promise<string> {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        // Told explicitly not to add commentary: whatever it says goes
        // straight onto the page.
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

    if (!response.ok) throw new Error(`Claude: ${body?.error?.message ?? response.statusText}`)

    const translated = body?.content?.find((part) => part.type === 'text')?.text?.trim()
    if (!translated) throw new Error('Claude returned nothing')

    return translated
  }
}

// --- Selection ---------------------------------------------------------------

export type ProviderName = 'deepl' | 'libretranslate' | 'claude'

interface ProviderConfig {
  provider?: string
  deeplKey?: string
  libreUrl?: string
  libreKey?: string
  anthropicKey?: string
}

/**
 * Picks a provider from what is configured.
 *
 * `TRANSLATION_PROVIDER` forces one; otherwise the first that has its
 * configuration wins, DeepL first because it is the free one. Returns null
 * when nothing is set up, which is a supported state: the site then shows the
 * language the content was written in, and the admin says so.
 */
export function selectProvider(config: ProviderConfig): TranslationProvider | null {
  const forced = config.provider?.toLowerCase() as ProviderName | undefined

  const build: Record<ProviderName, () => TranslationProvider | null> = {
    deepl: () => (config.deeplKey ? new DeepLProvider(config.deeplKey) : null),
    libretranslate: () =>
      config.libreUrl ? new LibreTranslateProvider(config.libreUrl, config.libreKey) : null,
    claude: () => (config.anthropicKey ? new ClaudeProvider(config.anthropicKey) : null),
  }

  if (forced) return build[forced]?.() ?? null

  return build.deepl() ?? build.libretranslate() ?? build.claude()
}
