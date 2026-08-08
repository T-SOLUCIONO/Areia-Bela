'use client'

import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent } from '@areia-bela/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * Deliberately empty until maintenance tasks exist.
 *
 * What stood here was five invented jobs with invented assignees — "Carlos" on a
 * slow drain, "Marta" on a coffee filter — and three counters above them. There
 * is no model and no endpoint: the "Add task" button already carried a comment
 * saying it does nothing on purpose.
 *
 * Same reasoning as `/admin/coupons` and `/admin/reports`: a host who reads
 * "3 pending" has been told something about their house that is not true, and a
 * name beside a job is worse — it implicates a person who was never asked.
 */
export default function MaintenancePage() {
  const t = useAdminCopy()
  const copy = t.maintenance

  return (
    <Card>
      <CardContent className="pt-6">
        <Empty>
          <EmptyMedia variant="icon">
            <Wrench aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{copy.emptyTitle}</EmptyTitle>
          <EmptyDescription>{copy.emptyBody}</EmptyDescription>
          <EmptyDescription className="mt-2">{copy.emptyWhat}</EmptyDescription>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/calendar">{t.nav.calendar}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/reservations">{t.nav.reservations}</Link>
            </Button>
          </div>
        </Empty>
      </CardContent>
    </Card>
  )
}
