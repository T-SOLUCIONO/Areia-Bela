'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LANGUAGE_COOKIE } from '@areia-bela/shared'
import { adminCopy, type AdminCopy } from '@/lib/admin-i18n'
import type { Language } from '@/lib/i18n'

type AdminLanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: AdminCopy
}

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null)

/**
 * The admin's own language state, separate from the public site's provider on
 * purpose. That one derives the language from the `[locale]` URL segment and
 * navigates on change — but `/admin` is deliberately excluded from the locale
 * rewrite, so reusing it would push `/es/admin/...` and 404.
 *
 * Here the language is plain state persisted in the same cookie, so switching
 * it in the panel also switches the guest site, and vice versa.
 */
export function AdminLanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: Language
  children: React.ReactNode
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    document.cookie = `${LANGUAGE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`
  }, [])

  const value = useMemo(
    () => ({ language, setLanguage, t: adminCopy[language] }),
    [language, setLanguage],
  )

  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>
}

export function useAdminLanguage(): AdminLanguageContextValue {
  const context = useContext(AdminLanguageContext)
  if (!context) throw new Error('useAdminLanguage must be used within AdminLanguageProvider')
  return context
}

/** Shorthand for the common case of only needing the strings. */
export function useAdminCopy(): AdminCopy {
  return useAdminLanguage().t
}
