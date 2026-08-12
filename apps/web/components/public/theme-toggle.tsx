'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/lib/i18n'
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
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const copy = translations[useLanguage().language].ui

  useEffect(() => setMounted(true), [])

  const dark = resolvedTheme === 'dark'
  const label = dark ? copy.themeLight : copy.themeDark

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={mounted ? label : copy.themeDark}
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
