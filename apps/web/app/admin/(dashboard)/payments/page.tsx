'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, startOfMonth, startOfYear, subMonths, endOfMonth } from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import { AlertTriangle, CreditCard, Info, Loader2 } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent } from '@areia-bela/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { apiFetch } from '@/lib/api-client'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { adminCopy, fill } from '@/lib/admin-i18n'
import { cn } from '@/lib/utils'

interface LedgerRow {
  id: string
  type: string
  createdAt: string
  chargedAmount: number | null
  chargedCurrency: string | null
  settledAmount: number
  processingFee: number
  conversionFee: number
  otherFees: number
  net: number
  status: string
  reference: string | null
  guestName: string | null
}

interface Report {
  from: string
  to: string
  settlementCurrency: string
  convertsCurrency: boolean
  totals: {
    charged: number
    chargedCurrency: string
    refunded: number
    settled: number
    settledRefunded: number
    processingFees: number
    conversionFees: number
    otherFees: number
    net: number
  }
  rows: LedgerRow[]
  payouts: Array<{
    id: string
    amount: number
    status: string
    arrivesOn: string
    createdAt: string
  }>
  balance: Array<{ currency: string; available: number; pending: number }>
  connected: boolean
}

type Period = 'thisMonth' | 'lastMonth' | 'thisYear'

const rangeFor = (period: Period) => {
  const now = new Date()
  if (period === 'lastMonth') {
    const previous = subMonths(now, 1)
    return { from: startOfMonth(previous), to: endOfMonth(previous) }
  }
  if (period === 'thisYear') return { from: startOfYear(now), to: now }
  return { from: startOfMonth(now), to: now }
}

/**
 * The money, from Stripe rather than from our own bookings.
 *
 * Adding up `Booking.totalPrice` would be easy and wrong: this house prices in
 * USD while the Stripe account settles in EUR, so a booking passes through a
 * conversion and two fees before anything reaches the bank. The gap is over
 * five percent, and it is the host's money — so the panel shows both figures
 * and never implies the first one is what she gets.
 */
export default function PaymentsPage() {
  const { language } = useAdminLanguage()
  const copy = adminCopy[language].payments
  const dateLocale = language === 'en' ? enUS : esLocale

  const [period, setPeriod] = useState<Period>('thisMonth')
  const [report, setReport] = useState<Report | null>(null)
  const [failed, setFailed] = useState(false)
  // Derived rather than a third flag set inside the effect: "the period on
  // screen is not the one we have data for" is what loading actually means,
  // and saying it this way keeps the effect free of synchronous setState.
  const [loadedPeriod, setLoadedPeriod] = useState<Period | null>(null)
  const loading = loadedPeriod !== period

  const load = useCallback(async (next: Period) => {
    const { from, to } = rangeFor(next)
    try {
      setReport(
        await apiFetch<Report>(
          `/payments?from=${format(from, 'yyyy-MM-dd')}&to=${format(to, 'yyyy-MM-dd')}`,
        ),
      )
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoadedPeriod(next)
    }
  }, [])

  useEffect(() => {
    void load(period)
  }, [load, period])

  const settled = (amount: number) =>
    `${amount.toLocaleString(language === 'en' ? 'en-US' : 'es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${(report?.settlementCurrency ?? 'eur').toUpperCase()}`

  const guestMoney = (amount: number) =>
    `${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${(report?.totals.chargedCurrency ?? 'usd').toUpperCase()}`

  const typeLabel = (type: string) =>
    (copy as unknown as Record<string, string>)[`type${type}`] ?? type

  if (failed) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CreditCard />
          </EmptyMedia>
          <EmptyTitle>{copy.title}</EmptyTitle>
          <EmptyDescription>{copy.loadFailed}</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => void load(period)}>
          {adminCopy[language].common.retry}
        </Button>
      </Empty>
    )
  }

  const unmatched = report?.rows.filter((row) => !row.reference && row.type !== 'payout') ?? []

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-foreground">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.lead}</p>
        </div>

        <div className="flex gap-2">
          {(['thisMonth', 'lastMonth', 'thisYear'] as const).map((option) => (
            <Button
              key={option}
              variant={period === option ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(option)}
            >
              {copy[option]}
            </Button>
          ))}
        </div>
      </div>

      {loading || !report ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : !report.connected ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {copy.notConnected}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={copy.charged} value={guestMoney(report.totals.charged)} />
            <Stat label={copy.refunded} value={guestMoney(report.totals.refunded)} muted />
            <Stat label={copy.settled} value={settled(report.totals.settled)} muted />
            <Stat label={copy.net} value={settled(report.totals.net)} hint={copy.netLead} strong />
          </div>

          {/* The conversion fee is the one nobody expects, so it is named rather
              than folded into a single "fees" figure. */}
          {report.convertsCurrency && report.totals.conversionFees > 0 && (
            <div className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {fill(copy.conversionWarning, {
                  charged: report.totals.chargedCurrency.toUpperCase(),
                  settled: report.settlementCurrency.toUpperCase(),
                  amount: settled(report.totals.conversionFees),
                })}
              </p>
            </div>
          )}

          <Card>
            <CardContent className="space-y-3 py-5">
              <FeeLine label={copy.settled} value={settled(report.totals.settled)} />
              <FeeLine
                label={copy.refunded}
                value={`− ${settled(report.totals.settledRefunded)}`}
              />
              <FeeLine
                label={copy.processingFees}
                value={`− ${settled(report.totals.processingFees)}`}
              />
              <FeeLine
                label={copy.conversionFees}
                value={`− ${settled(report.totals.conversionFees)}`}
              />
              {report.totals.otherFees > 0 && (
                <FeeLine label={copy.otherFees} value={`− ${settled(report.totals.otherFees)}`} />
              )}
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
                <span>{copy.net}</span>
                <span className="tabular-nums">{settled(report.totals.net)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="py-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {copy.balance}
                </h2>
                <dl className="mt-3 space-y-2">
                  {report.balance.map((entry) => (
                    <div key={entry.currency} className="flex justify-between text-sm">
                      <dt className="text-muted-foreground">
                        {copy.available} · {entry.currency.toUpperCase()}
                      </dt>
                      <dd className="tabular-nums text-foreground">{entry.available.toFixed(2)}</dd>
                    </div>
                  ))}
                  {report.balance.map((entry) => (
                    <div key={`${entry.currency}-p`} className="flex justify-between text-sm">
                      <dt className="text-muted-foreground">
                        {copy.pendingBalance} · {entry.currency.toUpperCase()}
                      </dt>
                      <dd className="tabular-nums text-muted-foreground">
                        {entry.pending.toFixed(2)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {copy.payouts}
                </h2>
                {report.payouts.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">{copy.noPayouts}</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {report.payouts.map((payout) => (
                      <li key={payout.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {fill(copy.arrives, {
                            date: format(new Date(payout.arrivesOn), 'd MMM', {
                              locale: dateLocale,
                            }),
                          })}
                        </span>
                        <span className="tabular-nums text-foreground">
                          {payout.amount.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Money with no booking behind it is worth naming, not hiding: it is
              either taken outside the site or a booking that never got made. */}
          {unmatched.length > 0 && (
            <div className="flex items-start gap-3 rounded-[12px] bg-muted/60 p-4 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{fill(copy.unmatchedLead, { count: String(unmatched.length) })}</p>
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.ledger} · {report.rows.length}
            </h2>

            {report.rows.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  {copy.empty}
                </CardContent>
              </Card>
            ) : (
              <Card>
                {/* Its own scroller: seven money columns will not fit a phone,
                    and the page body must never scroll sideways. */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[46rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">{copy.colDate}</th>
                        <th className="px-4 py-3 font-semibold">{copy.colType}</th>
                        <th className="px-4 py-3 font-semibold">{copy.colBooking}</th>
                        <th className="px-4 py-3 text-right font-semibold">{copy.colCharged}</th>
                        <th className="px-4 py-3 text-right font-semibold">{copy.colSettled}</th>
                        <th className="px-4 py-3 text-right font-semibold">{copy.colFees}</th>
                        <th className="px-4 py-3 text-right font-semibold">{copy.colNet}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => {
                        const fees = row.processingFee + row.conversionFee + row.otherFees
                        return (
                          <tr key={row.id} className="border-b border-border/60 last:border-0">
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                              {format(new Date(row.createdAt), 'd MMM', { locale: dateLocale })}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">{typeLabel(row.type)}</td>
                            <td className="px-4 py-3">
                              {row.reference ? (
                                <span className="text-foreground">
                                  {row.reference}
                                  {row.guestName && (
                                    <span className="block text-xs text-muted-foreground">
                                      {row.guestName}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">{copy.unmatched}</span>
                              )}
                            </td>
                            <td
                              className={cn(
                                'whitespace-nowrap px-4 py-3 text-right tabular-nums',
                                row.chargedAmount !== null && row.chargedAmount < 0
                                  ? 'text-muted-foreground'
                                  : 'text-foreground',
                              )}
                            >
                              {row.chargedAmount === null
                                ? '—'
                                : row.chargedAmount.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                              {row.settledAmount.toFixed(2)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                              {fees === 0 ? '—' : fees.toFixed(2)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-foreground">
                              {row.net.toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  muted = false,
  strong = false,
}: {
  label: string
  value: string
  hint?: string
  muted?: boolean
  strong?: boolean
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-1 tabular-nums',
            strong ? 'text-2xl font-semibold text-foreground' : 'text-xl',
            muted && !strong ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function FeeLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
