'use client'

import { useEffect, useState } from 'react'
import { Languages, TriangleAlert } from 'lucide-react'
import { landing } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * Says whether the site is actually translating.
 *
 * Without this the failure is silent and confusing: the host writes in
 * Spanish, sees the site stay Spanish in French, and has no way to know the
 * cause is a missing key rather than a bug.
 */
export function TranslationNotice() {
  const t = useAdminCopy()
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    landing.translationEnabled().then(setConfigured, () => setConfigured(false))
  }, [])

  if (configured === null) return null

  if (!configured) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div>
          <p className="font-medium">{t.content.translationOffTitle}</p>
          <p className="text-muted-foreground">{t.content.translationOffBody}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <Languages className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p>{t.content.sourceLanguageNote}</p>
    </div>
  )
}
