'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { LANGUAGE_COOKIE } from '@areia-bela/shared'
import { adminCopy, type AdminCopy } from '@/lib/admin-i18n'
import type { AdminLanguage } from '@/lib/admin-i18n'

type AdminLanguageContextValue = {
  language: AdminLanguage
  setLanguage: (language: AdminLanguage) => void
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
  initialLanguage: AdminLanguage
  children: React.ReactNode
}) {
  const [language, setLanguageState] = useState<AdminLanguage>(initialLanguage)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: AdminLanguage) => {
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

/**
 * The strings, without dragging them into a dependency array.
 *
 * Every data-loading screen had its fetch keyed on an error message —
 * `useCallback(..., [t.property.loadFailed])` — because the callback used one
 * in a toast. Switching language changes that string, so the callback was
 * rebuilt, the effect watching it fired, and the screen refetched. On a form
 * that meant `setDraft(stored)`: everything the host had typed, replaced by
 * what was on the server, for choosing a different language.
 *
 * A message is not a reason to refetch. This keeps the latest copy reachable
 * from inside a callback while staying stable across renders.
 */
export function useAdminCopyRef(): { readonly current: AdminCopy } {
  const { t } = useAdminLanguage()
  const ref = useRef(t)

  // Assigned in an effect rather than during render: a ref mutated while
  // rendering is not safe under concurrent React, and a message that lags by
  // one commit is a message nobody can tell apart.
  useEffect(() => {
    ref.current = t
  }, [t])

  return ref
}
