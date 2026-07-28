'use client'

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LANGUAGE_COOKIE, pathForLocale } from '@areia-bela/shared'
import type { Language } from '@/lib/i18n'

// Re-exported for convenience; defined in @areia-bela/shared because server
// components need it too and can't read a constant out of a client module.
export { LANGUAGE_COOKIE }

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({
  children,
  language,
}: {
  children: React.ReactNode
  language: Language
}) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  // No local state on purpose: the `[locale]` URL segment is the single source
  // of truth, so navigating is what changes the language. That makes it
  // impossible for a shared /es link or back-button navigation to drift out of
  // sync with the copy on screen.
  const setLanguage = useCallback(
    (next: Language) => {
      document.cookie = `${LANGUAGE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`

      router.push(pathForLocale(pathname, next))
    },
    [pathname, router],
  )

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
