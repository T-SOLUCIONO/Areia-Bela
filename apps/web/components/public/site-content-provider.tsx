'use client'

import { createContext, useContext } from 'react'
import type { SiteContent } from '@/lib/cms-public'

const SiteContentContext = createContext<SiteContent | null>(null)

/**
 * Carries the CMS content fetched by the server layout down to the client
 * components that render the page. The fetch stays on the server so the copy
 * is in the HTML — a guest site whose text arrives after hydration is invisible
 * to search engines.
 */
export function SiteContentProvider({
  content,
  children,
}: {
  content: SiteContent
  children: React.ReactNode
}) {
  return <SiteContentContext.Provider value={content}>{children}</SiteContentContext.Provider>
}

/** Null when the API was unreachable; callers fall back to the bundled copy. */
export function useSiteContent(): SiteContent | null {
  return useContext(SiteContentContext)
}
