'use client'

import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { cms } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * Warns when an upload is going to disappear.
 *
 * With no image storage configured, the API writes the file into its own
 * container and returns a path the **web** serves — two different containers in
 * any real deployment. The upload reports success, the row stores the URL, and
 * the picture 404s for ever.
 *
 * That failure is silent by construction, which is the worst kind: a host fills
 * the gallery over an afternoon and finds out weeks later. Nothing about the
 * screen can hint at it, so the screen has to say it.
 *
 * Renders nothing once storage is configured — a banner that is always there
 * stops being read.
 */
export function StorageNotice() {
  const t = useAdminCopy()
  const [backend, setBackend] = useState<'gcs' | 'blob' | 'local' | null>(null)

  useEffect(() => {
    // A failed check says nothing rather than crying wolf: the panel not being
    // able to ask is a different problem from storage being unconfigured.
    cms.storageStatus().then(
      (status) => setBackend(status.backend),
      () => setBackend(null),
    )
  }, [])

  if (backend !== 'local') return null

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <div>
        <p className="font-medium">{t.content.storageLocalTitle}</p>
        <p className="text-muted-foreground">{t.content.storageLocalBody}</p>
      </div>
    </div>
  )
}
