import { DeepLProvider, LibreTranslateProvider, selectProvider } from './translation-providers'

describe('selectProvider', () => {
  it('prefers DeepL, which is the free one', () => {
    const provider = selectProvider({ deeplKey: 'k:fx', anthropicKey: 'sk-ant' })
    expect(provider?.name).toBe('DeepL')
  })

  it('falls through to what is actually configured', () => {
    expect(selectProvider({ libreUrl: 'http://localhost:5000' })?.name).toBe('LibreTranslate')
    expect(selectProvider({ anthropicKey: 'sk-ant' })?.name).toBe('Claude')
  })

  it('honours an explicit choice over the preference order', () => {
    const provider = selectProvider({
      provider: 'claude',
      deeplKey: 'k:fx',
      anthropicKey: 'sk-ant',
    })
    expect(provider?.name).toBe('Claude')
  })

  it('returns nothing when the forced provider has no configuration', () => {
    // Better than silently using another one: the host asked for that service.
    expect(selectProvider({ provider: 'deepl', anthropicKey: 'sk-ant' })).toBeNull()
  })

  it('returns nothing when none is configured, which is a supported state', () => {
    expect(selectProvider({})).toBeNull()
  })

  it('ignores a provider name it does not know', () => {
    expect(selectProvider({ provider: 'babelfish', deeplKey: 'k:fx' })).toBeNull()
  })
})

describe('DeepLProvider', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ translations: [{ text: 'Bonjour' }] }),
    })
  })

  const call = (key: string) => new DeepLProvider(key).translate('Hola', 'es', 'fr')
  const lastRequest = () => ({
    url: fetchMock.mock.calls[0][0] as string,
    body: JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as Record<
      string,
      unknown
    >,
  })

  it('sends a free-tier key to the free host', async () => {
    // Free keys end in ":fx" and 404 against the paid host, which is a
    // confusing way to find out you used the wrong URL.
    await call('abc:fx')
    expect(lastRequest().url).toContain('api-free.deepl.com')
  })

  it('sends a paid key to the paid host', async () => {
    await call('abc')
    expect(lastRequest().url).toBe('https://api.deepl.com/v2/translate')
  })

  it('asks for a regional variant of English and Portuguese', async () => {
    // DeepL rejects a bare "EN" target.
    await new DeepLProvider('k:fx').translate('Hola', 'es', 'en')
    expect(lastRequest().body.target_lang).toBe('EN-US')

    fetchMock.mockClear()
    await new DeepLProvider('k:fx').translate('Hola', 'es', 'pt')
    expect(lastRequest().body.target_lang).toBe('PT-BR')
  })

  it('keeps line breaks, which several fields rely on', async () => {
    await call('k:fx')
    expect(lastRequest().body.preserve_formatting).toBe(true)
  })

  it('names the quota when it runs out, rather than reporting a bare 456', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 456, json: () => Promise.resolve({}) })
    await expect(call('k:fx')).rejects.toThrow(/quota/i)
  })
})

describe('LibreTranslateProvider', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ translatedText: 'Bonjour' }),
    })
  })

  it('does not double the slash when the URL has a trailing one', async () => {
    await new LibreTranslateProvider('http://localhost:5000/').translate('Hola', 'es', 'fr')
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:5000/translate')
  })

  it('omits the api_key field entirely when self-hosted without one', async () => {
    await new LibreTranslateProvider('http://localhost:5000').translate('Hola', 'es', 'fr')
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as Record<
      string,
      unknown
    >
    expect(body).not.toHaveProperty('api_key')
  })
})
