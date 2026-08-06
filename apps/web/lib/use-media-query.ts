'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * A CSS media query, as React state.
 *
 * `useSyncExternalStore` rather than an effect: the viewport is an external
 * system React should subscribe to, and this is the API built for that. It also
 * takes a server snapshot, so the first paint is a decision rather than a guess
 * that then jumps.
 *
 * @param query the media query
 * @param serverValue what the server should assume, since it has no viewport.
 *   Pick the layout that is right for the reader most likely to notice a
 *   correction — a desktop visitor sees the wide layout immediately and a phone
 *   fixes itself on hydration.
 */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}

/** Below Tailwind's `md`, where the calendar takes over the screen. */
export const PHONE_QUERY = '(max-width: 47.999rem)'
