'use client'

import Link from 'next/link'
import { Ticket } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent } from '@areia-bela/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * Deliberately empty until coupons exist.
 *
 * What stood here was a mock: five codes, 254 redemptions and $20,500 of
 * savings, none of it real, and all of it in English inside a Spanish panel.
 * There is no `Coupon` model, no endpoint and no discount anywhere in pricing —
 * the screen was a picture of a feature.
 *
 * `CLAUDE.md` is explicit that inventing price figures is worse than leaving
 * them pending, and a host reading $20,500 of savings has been told something
 * false about their own business. `/admin/reports` set this precedent when it
 * replaced 339 lines of invented revenue.
 *
 * The note about where a discount belongs is not decoration either: whoever
 * builds this has to apply it in `computeQuote`, server-side, because the
 * browser never gets to say what a stay costs.
 */
export default function CouponsPage() {
  const t = useAdminCopy()
  const copy = t.coupons

  return (
    <Card>
      <CardContent className="pt-6">
        <Empty>
          <EmptyMedia variant="icon">
            <Ticket aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{copy.emptyTitle}</EmptyTitle>
          <EmptyDescription>{copy.emptyBody}</EmptyDescription>
          <EmptyDescription className="mt-2">{copy.emptyWhat}</EmptyDescription>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/pricing">{copy.seePricing}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/reservations">{copy.seeReservations}</Link>
            </Button>
          </div>
        </Empty>
      </CardContent>
    </Card>
  )
}
