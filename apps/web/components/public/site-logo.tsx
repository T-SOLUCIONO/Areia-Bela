'use client'

import Image from 'next/image'
import { useSiteContent } from '@/components/public/site-content-provider'
import { cn } from '@/lib/utils'

/** Shipped with the site; both are the same mark, drawn for opposite grounds. */
const BUNDLED_LIGHT = '/areia-bela-logo.png'
const BUNDLED_DARK = '/areia-bela-logo-dark.png'

/**
 * The mark, in whichever version the ground under it needs.
 *
 * The logo is black ink and a turquoise starfish on transparency, drawn for a
 * white page. On a dark header the wordmark all but disappears and only the
 * starfish survives — and flattening it to white in CSS takes the turquoise with
 * it, because a filter cannot tell ink from colour. So there are two files, both
 * editable in /admin/settings.
 *
 * The swap is CSS, not `useTheme()`: `next-themes` writes the `dark` class before
 * the first paint, while a hook only knows the theme in the browser, so a hook
 * would render the light mark on the server and flip it after hydration. Both
 * files are ~10 kB; a visible flip costs more than the second request.
 */
export function SiteLogo({
  className,
  /**
   * `auto` follows the page theme. `dark` forces the light-ground-safe version
   * for a mark sitting on something dark in *either* theme — the header over the
   * hero photo, whose scrim is navy whatever the theme is doing.
   */
  variant = 'auto',
  width = 200,
  height = 80,
}: {
  className?: string
  variant?: 'auto' | 'dark'
  width?: number
  height?: number
}) {
  const settings = useSiteContent()?.settings
  const light = settings?.logoUrl ?? BUNDLED_LIGHT
  /**
   * Whatever the host uploaded is what gets drawn, untouched.
   *
   * No CSS filter anywhere: a file she uploaded for a dark ground is already
   * right, and flattening one to white would only ever be a guess about a file
   * this component cannot see. The bundled mark is the fallback for a site with
   * no settings at all, not a way to patch a half-filled one.
   */
  const dark = settings?.logoDarkUrl ?? settings?.logoUrl ?? BUNDLED_DARK

  if (variant === 'dark') {
    return <Image src={dark} alt="Areia Bela" width={width} height={height} className={className} />
  }

  return (
    <>
      <Image
        src={light}
        alt="Areia Bela"
        width={width}
        height={height}
        className={cn(className, 'dark:hidden')}
      />
      <Image
        src={dark}
        alt=""
        aria-hidden
        width={width}
        height={height}
        className={cn(className, 'hidden dark:block')}
      />
    </>
  )
}
