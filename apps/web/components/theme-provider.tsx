'use client'

import { ThemeProvider as NextThemes } from 'next-themes'

/**
 * Dark mode, for the first time.
 *
 * The `.dark` token block had existed in `globals.css` for a long while as dead
 * code: nothing ever added the class, so every value in it was unused. This turns
 * it on.
 *
 * `next-themes` rather than a hand-rolled toggle for the one part that is hard to
 * get right by hand: it writes the class before the first paint, so somebody who
 * chose dark does not get a flash of the light theme on every navigation.
 *
 * Defaults to the system preference. Somebody whose phone is dark at night did not
 * ask this site to be the bright exception.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  )
}
