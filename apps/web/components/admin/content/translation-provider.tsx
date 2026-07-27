'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { landing } from '@/lib/cms-client'

const TranslationContext = createContext(false)

/**
 * Asks once whether the API has a translation key, instead of every bilingual
 * field asking for itself. Without a key the button is hidden rather than
 * shown and failing — an control that only ever errors is worse than none.
 */
export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    landing.translationEnabled().then(setAvailable, () => setAvailable(false))
  }, [])

  return <TranslationContext.Provider value={available}>{children}</TranslationContext.Provider>
}

export function useTranslationAvailable(): boolean {
  return useContext(TranslationContext)
}
