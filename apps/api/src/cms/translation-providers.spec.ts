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
    // One stub for every call shape: list glossaries, create one, translate.
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          glossaries: [],
          glossary_id: 'g1',
          translations: [{ text: 'Bonjour' }],
        }),
    })
  })

  const call = (key: string) => new DeepLProvider(key).translate('Hola', 'es', 'fr')

  /** The translate request is the last one; the earlier ones set up the glossary. */
  const lastRequest = () => {
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, { body: string }]
    return { url, body: JSON.parse(init.body) as Record<string, unknown> }
  }

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

    await new DeepLProvider('k:fx').translate('Hola', 'es', 'pt')
    expect(lastRequest().body.target_lang).toBe('PT-BR')
  })

  it('keeps line breaks, which several fields rely on', async () => {
    await call('k:fx')
    expect(lastRequest().body.preserve_formatting).toBe(true)
  })

  it('restores a place name that came back translated', async () => {
    // DeepL renders "St. Petersburg" as "Saint-Pétersbourg" in French — the
    // Russian city. The name is learned once per language, then swapped back.
    const provider = new DeepLProvider('k:fx')
    fetchMock.mockImplementation((_url: string, init: { body: string }) => {
      const { text } = JSON.parse(init.body) as { text: string[] }
      const answer = text[0].includes('St. Petersburg')
        ? text[0].replace('St. Petersburg', 'Saint-Pétersbourg')
        : text[0]
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ translations: [{ text: answer }] }),
      })
    })

    await expect(provider.translate('Casa en St. Petersburg', 'es', 'fr')).resolves.toBe(
      'Casa en St. Petersburg',
    )
  })

  it('restores the full stop DeepL drops from an abbreviation', async () => {
    // Not a translation, just normalisation — the source spelling should win.
    const provider = new DeepLProvider('k:fx')
    fetchMock.mockImplementation((_url: string, init: { body: string }) => {
      const { text } = JSON.parse(init.body) as { text: string[] }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ translations: [{ text: text[0].replace('St.', 'St') }] }),
      })
    })

    await expect(provider.translate('Casa en St. Petersburg', 'es', 'fr')).resolves.toBe(
      'Casa en St. Petersburg',
    )
  })

  it('learns the names once per language, not once per translation', async () => {
    const provider = new DeepLProvider('k:fx')
    await provider.translate('a', 'es', 'fr')
    const afterFirst = fetchMock.mock.calls.length

    await provider.translate('b', 'es', 'fr')
    expect(fetchMock.mock.calls.length).toBe(afterFirst + 1)
  })

  it('still translates when learning the names fails', async () => {
    // Place names may come out translated, which is far better than refusing
    // to translate the page at all.
    // The real translation lands first; the calls that learn the place names
    // come after it and are the ones failing here.
    let call = 0
    fetchMock.mockImplementation(() => {
      call += 1
      return call === 1
        ? Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ translations: [{ text: 'Bonjour' }] }),
          })
        : Promise.reject(new Error('network'))
    })

    await expect(new DeepLProvider('k:fx').translate('Hola', 'es', 'fr')).resolves.toBe('Bonjour')
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
