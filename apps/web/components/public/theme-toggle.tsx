'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

/**
 * Switches between light and dark.
 *
 * Draws nothing inside the button until mounted. The theme is only known in the
 * browser, so rendering the sun or the moon on the server would be a guess, and a
 * wrong guess is a hydration mismatch — the same class of bug the clock caused on
 * the quoter's calendar. The button keeps its size either way, so the header does
 * not shift when it resolves.
 */
export function ThemeToggle({
  className,
  darkLabel = 'Cambiar a modo oscuro',
  lightLabel = 'Cambiar a modo claro',
}: {
  className?: string
  /**
   * Labels as props rather than read from `useLanguage`.
   *
   * The toggle has to work outside the public layout — the alternate landing at
   * `/preview` has no `LanguageProvider`, and reading the language internally made
   * the button crash the build there. Whoever renders it knows which language they
   * are in; the button does not need to.
   */
  darkLabel?: string
  lightLabel?: string
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const dark = resolvedTheme === 'dark'
  const label = dark ? lightLabel : darkLabel

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={mounted ? label : darkLabel}
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-foreground transition-colors hover:bg-muted',
        className,
      )}
    >
      {mounted ? (
        dark ? (
          <Sun className="h-4 w-4" aria-hidden />
        ) : (
          <Moon className="h-4 w-4" aria-hidden />
        )
      ) : (
        <span className="h-4 w-4" aria-hidden />
      )}
    </button>
  )
}
