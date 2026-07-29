'use client'

import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'

/**
 * Deliberately empty until there is something real to report.
 *
 * What stood here was 339 lines of invented figures — $752,000 of revenue,
 * Expedia commissions, per-room performance for "Presidential Suite" — in the
 * admin of a single three-bedroom house that is not listed on any of those
 * channels. Every one of those numbers was false, and the room breakdown and
 * channel mix are the hotel model CLAUDE.md forbids outright.
 *
 * Revenue and occupancy are computed from Booking rows, which Fase 6 creates.
 * Until then this page states the gap instead of filling it.
 */
export default function ReportsPage() {
  const { language } = useAdminLanguage()
  const isEnglish = language === 'en'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">{isEnglish ? 'Reports' : 'Informes'}</CardTitle>
        <CardDescription>
          {isEnglish
            ? 'Revenue and occupancy for the house, over time'
            : 'Ingresos y ocupación de la casa a lo largo del tiempo'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Empty>
          <EmptyMedia variant="icon">
            <BarChart3 aria-hidden />
          </EmptyMedia>
          <EmptyTitle>
            {isEnglish ? 'Nothing to report yet' : 'Todavía no hay nada que informar'}
          </EmptyTitle>
          <EmptyDescription>
            {isEnglish
              ? 'Reports are built from stored bookings, and bookings are not stored yet. Rather than show made-up totals, this page waits for the booking system.'
              : 'Los informes se arman con las reservas guardadas, y todavía no se guarda ninguna. En vez de mostrar totales inventados, esta pantalla espera al sistema de reservas.'}
          </EmptyDescription>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/calendar">
                {isEnglish ? 'See availability' : 'Ver disponibilidad'}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/pricing">{isEnglish ? 'See pricing' : 'Ver precios'}</Link>
            </Button>
          </div>
        </Empty>
      </CardContent>
    </Card>
  )
}
