'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Language } from '@/lib/i18n'

const STORAGE_KEY = 'areia_bela_language_v1'

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'es') {
      setLanguageState(saved)
      return
    }

    const browser = window.navigator.language.toLowerCase()
    setLanguageState(browser.startsWith('es') ? 'es' : 'en')
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const value = useMemo(() => ({ language, setLanguage: setLanguageState }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
