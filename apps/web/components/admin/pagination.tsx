'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'

/**
 * Splits a list the browser already has.
 *
 * Deliberately client-side. The endpoints still return everything, which is
 * fine for one house and is not what hurt: rendering four hundred cards is.
 * When the payload itself becomes the problem, the fix is a paged endpoint,
 * and this control keeps working on top of it.
 */
export function usePagination<T>(items: T[], perPage = 20) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(items.length / perPage))

  // Clamped while rendering rather than corrected afterwards.
  //
  // Deleting the last guest on page 7 leaves that page empty. Fixing it in an
  // effect would paint the empty page first and then jump; deriving it means
  // the empty page never exists. The stored page is left alone — the list may
  // grow back, and so should the position.
  const current = Math.min(page, pages)

  const from = (current - 1) * perPage
  return {
    page: current,
    pages,
    setPage,
    visible: items.slice(from, from + perPage),
    total: items.length,
    firstShown: items.length === 0 ? 0 : from + 1,
    lastShown: Math.min(from + perPage, items.length),
  }
}

export function Pagination({
  page,
  pages,
  onPage,
  firstShown,
  lastShown,
  total,
}: {
  page: number
  pages: number
  onPage: (page: number) => void
  firstShown: number
  lastShown: number
  total: number
}) {
  const t = useAdminCopy()

  // One page is no navigation. A control that never does anything is furniture.
  if (pages <= 1) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-xs text-muted-foreground">
        {fill(t.common.showingRange, {
          from: String(firstShown),
          to: String(lastShown),
          total: String(total),
        })}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t.common.previousPage}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {fill(t.common.pageOf, { page: String(page), pages: String(pages) })}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label={t.common.nextPage}
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
