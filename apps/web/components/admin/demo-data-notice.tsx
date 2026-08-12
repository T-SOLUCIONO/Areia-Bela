'use client'

import { FlaskConical } from 'lucide-react'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * Marks a screen whose numbers are invented. Deliberately plain and always
 * visible rather than dismissible: someone could otherwise make a real
 * decision from a fabricated figure. Comes off when the screen is wired to
 * the API.
 */
export function DemoDataNotice({ className }: { className?: string }) {
  const t = useAdminCopy()

  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-amber-900 ${className ?? ''}`}
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm">
        <span className="font-medium">{t.common.demoTitle}.</span> {t.common.demoBody}
      </p>
    </div>
  )
}
