'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, startOfMonth, startOfYear, subMonths, endOfMonth } from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import {
  AlertTriangle,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent } from '@areia-bela/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { apiFetch } from '@/lib/api-client'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { adminCopy, fill } from '@/lib/admin-i18n'
import { cn } from '@/lib/utils'

interface LedgerRow {
  id: string
  chargeId: string | null
  type: string
  createdAt: string
  chargedAmount: number | null
  chargedCurrency: string | null
  settledAmount: number
  settledCurrency: string
  processingFee: number
  conversionFee: number
  otherFees: number
  net: number
  status: string
  reference: string | null
  guestName: string | null
  payerEmail: string | null
  cardBrand: string | null
  cardLast4: string | null
  receiptUrl: string | null
  riskLevel: string | null
  disputed: boolean
}

interface PayerRow {
  email: string
  name: string | null
  payments: number
  paid: number
  refunded: number
  currency: string
  lastPaymentAt: string
  cardBrand: string | null
  cardLast4: string | null
  stripeCustomerId: string | null
  references: string[]
  guestId: string | null
  guestNameInDatabase: string | null
  guestBookings: number
}

interface DisputeRow {
  id: string
  amount: number
  currency: string
  reason: string
  status: string
  respondBy: string | null
  createdAt: string
  reference: string | null
  guestName: string | null
}

interface CurrencyTotals {
  settlementCurrency: string
  charged: number
  chargedCurrency: string
  refunded: number
  settled: number
  settledRefunded: number
  processingFees: number
  conversionFees: number
  otherFees: number
  net: number
  converts: boolean
}

interface Report {
  from: string
  to: string
  settlementCurrency: string
  accountCountry: string | null
  convertsCurrency: boolean
  mixedCurrencies: boolean
  totals: CurrencyTotals[]
  rows: LedgerRow[]
  payouts: Array<{
    id: string
    amount: number
    status: string
    arrivesOn: string
    createdAt: string
  }>
  balance: Array<{ currency: string; available: number; pending: number }>
  disputes: DisputeRow[]
  payers: PayerRow[]
  unattachedCustomers: number
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
 * Adding up `Booking.totalPrice` would be easy and wrong: Stripe's fee comes
 * off every booking, and while the account settled in EUR a currency
 * conversion came off too — over five percent between them. So the panel shows
 * what the guest paid and what actually arrived, and never implies the first is
 * what the host gets.
 *
 * Totals arrive grouped by settlement currency and are rendered that way. The
 * account moved from EUR to USD mid-ledger; one combined figure would be euros
 * added to dollars.
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

  const amountIn = (amount: number, currency: string) =>
    `${amount.toLocaleString(language === 'en' ? 'en-US' : 'es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency.toUpperCase()}`

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
          {/* Multiple currencies means the account changed country mid-period.
              Said out loud rather than silently showing two stacks of numbers
              that look like they should add up. */}
          {report.mixedCurrencies && (
            <div className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {fill(copy.mixedCurrencies, {
                  a: report.totals[0]?.settlementCurrency.toUpperCase() ?? '',
                  b: report.totals[1]?.settlementCurrency.toUpperCase() ?? '',
                })}
              </p>
            </div>
          )}

          {report.totals.map((block) => (
            <section key={block.settlementCurrency} className="space-y-4">
              {report.mixedCurrencies && (
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {fill(copy.settlesIn, { currency: block.settlementCurrency.toUpperCase() })}
                  {block.settlementCurrency !== report.settlementCurrency && ` · ${copy.historic}`}
                </h2>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label={copy.charged} value={amountIn(block.charged, block.chargedCurrency)} />
                <Stat
                  label={copy.refunded}
                  value={amountIn(block.refunded, block.chargedCurrency)}
                  muted
                />
                <Stat
                  label={copy.settled}
                  value={amountIn(block.settled, block.settlementCurrency)}
                  muted
                />
                <Stat
                  label={copy.net}
                  value={amountIn(block.net, block.settlementCurrency)}
                  hint={copy.netLead}
                  strong
                />
              </div>

              {/* The conversion fee is the one nobody expects, so it is named
                  rather than folded into a single "fees" figure. */}
              {block.converts && block.conversionFees > 0 && (
                <div className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    {fill(copy.conversionWarning, {
                      charged: block.chargedCurrency.toUpperCase(),
                      settled: block.settlementCurrency.toUpperCase(),
                      amount: amountIn(block.conversionFees, block.settlementCurrency),
                    })}
                  </p>
                </div>
              )}

              <Card>
                <CardContent className="space-y-3 py-5">
                  <FeeLine
                    label={copy.settled}
                    value={amountIn(block.settled, block.settlementCurrency)}
                  />
                  <FeeLine
                    label={copy.refunded}
                    value={`\u2212 ${amountIn(block.settledRefunded, block.settlementCurrency)}`}
                  />
                  <FeeLine
                    label={copy.processingFees}
                    value={`\u2212 ${amountIn(block.processingFees, block.settlementCurrency)}`}
                  />
                  {block.conversionFees > 0 && (
                    <FeeLine
                      label={copy.conversionFees}
                      value={`\u2212 ${amountIn(block.conversionFees, block.settlementCurrency)}`}
                    />
                  )}
                  {block.otherFees > 0 && (
                    <FeeLine
                      label={copy.otherFees}
                      value={`\u2212 ${amountIn(block.otherFees, block.settlementCurrency)}`}
                    />
                  )}
                  <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
                    <span>{copy.net}</span>
                    <span className="tabular-nums">
                      {amountIn(block.net, block.settlementCurrency)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </section>
          ))}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="py-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {copy.balance}
                </h2>
                <dl className="mt-3 space-y-3">
                  {report.balance.map((entry) => (
                    <div key={entry.currency}>
                      <dt className="text-xs font-medium uppercase tracking-wider text-foreground">
                        {entry.currency.toUpperCase()}
                      </dt>
                      <dd className="mt-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">{copy.available}</span>
                        <span className="tabular-nums text-foreground">
                          {entry.available.toFixed(2)}
                        </span>
                      </dd>
                      <dd className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{copy.pendingBalance}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {entry.pending.toFixed(2)}
                        </span>
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

          <section className="space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {copy.payers} · {report.payers.length}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.payersLead}</p>
              <p className="mt-1 text-sm text-muted-foreground">{copy.matchNote}</p>
            </div>

            {/* Stripe customer records with nothing attached: worth explaining
                once rather than leaving two lists that mysteriously disagree. */}
            {report.unattachedCustomers > 0 && (
              <div className="flex items-start gap-3 rounded-[12px] bg-muted/60 p-4 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {fill(copy.unattachedCustomersNote, {
                    count: String(report.unattachedCustomers),
                  })}
                </p>
              </div>
            )}

            {report.payers.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  {copy.payersEmpty}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {report.payers.map((payer) => (
                  <Card key={payer.email}>
                    <CardContent className="flex items-start justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {payer.name ?? payer.email}
                        </p>
                        {payer.name && (
                          <p className="truncate text-sm text-muted-foreground">{payer.email}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {payer.payments === 1
                            ? copy.payerOnePayment
                            : fill(copy.payerPayments, { count: String(payer.payments) })}
                          {' · '}
                          {fill(copy.payerLast, {
                            date: format(new Date(payer.lastPaymentAt), 'd MMM', {
                              locale: dateLocale,
                            }),
                          })}
                        </p>
                        {payer.cardBrand && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            <span className="capitalize">{payer.cardBrand}</span> ••
                            {payer.cardLast4}
                          </p>
                        )}
                        {/* The certain link first, and named as such. */}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {payer.references.length > 0 ? (
                            <>
                              <span className="font-medium text-foreground">
                                {copy.matchedByPayment}:{' '}
                              </span>
                              {payer.references.join(' · ')}
                            </>
                          ) : (
                            copy.payerNoBooking
                          )}
                        </p>

                        {/* Then the weaker one, which is still worth knowing: a
                            payment with no booking made by someone who has
                            stayed three times is not the same as one from a
                            stranger. */}
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3 shrink-0" />
                          {payer.guestNameInDatabase ? (
                            <span>
                              {fill(copy.matchedByEmail, { name: payer.guestNameInDatabase })}
                              {' · '}
                              {fill(copy.matchedByEmailStays, {
                                count: String(payer.guestBookings),
                              })}
                            </span>
                          ) : (
                            copy.notInDatabase
                          )}
                        </p>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {payer.stripeCustomerId ? copy.stripeCustomer : copy.noStripeCustomer}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums text-foreground">
                          {amountIn(payer.paid, payer.currency)}
                        </p>
                        {payer.refunded > 0 && (
                          <p className="text-xs tabular-nums text-muted-foreground">
                            − {amountIn(payer.refunded, payer.currency)}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Above the ledger on purpose. A chargeback has a deadline and loses
              the money by default; it is not a row to scroll past. */}
          {report.disputes.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-start gap-3 rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{copy.disputes}</p>
                  <p className="mt-0.5">{copy.disputesLead}</p>
                </div>
              </div>
              {report.disputes.map((dispute) => (
                <Card key={dispute.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {dispute.reference ?? copy.unmatched}
                        {dispute.guestName && (
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            {dispute.guestName}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {dispute.reason} · {dispute.status}
                        {dispute.respondBy &&
                          ` · ${fill(copy.disputeRespondBy, {
                            date: format(new Date(dispute.respondBy), 'd MMM', {
                              locale: dateLocale,
                            }),
                          })}`}
                      </p>
                    </div>
                    <p className="text-lg font-semibold tabular-nums text-foreground">
                      {amountIn(dispute.amount, dispute.currency)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

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
                  <table className="w-full min-w-[60rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">{copy.colDate}</th>
                        <th className="px-4 py-3 font-semibold">{copy.colType}</th>
                        <th className="px-4 py-3 font-semibold">{copy.colBooking}</th>
                        <th className="px-4 py-3 font-semibold">{copy.colPayer}</th>
                        <th className="px-4 py-3 text-right font-semibold">{copy.colCharged}</th>
                        <th className="px-4 py-3 text-right font-semibold">{copy.colSettled}</th>
                        <th className="px-4 py-3 text-left font-semibold" />
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
                            <td className="px-4 py-3">
                              {row.cardBrand ? (
                                <span className="text-foreground">
                                  <span className="capitalize">{row.cardBrand}</span> ••
                                  {row.cardLast4}
                                  {row.payerEmail && (
                                    <span className="block text-xs text-muted-foreground">
                                      {row.payerEmail}
                                    </span>
                                  )}
                                  {/* Stripe's own receipt, so the host can forward
                                      one without digging through the dashboard. */}
                                  {row.receiptUrl && (
                                    <a
                                      href={row.receiptUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                    >
                                      {copy.receipt}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                  {/* Only when Stripe flags it. A "normal" badge on
                                      every row would train the eye to skip it. */}
                                  {row.riskLevel && row.riskLevel !== 'normal' && (
                                    <span className="mt-1 block text-xs font-medium text-amber-700">
                                      {(copy as unknown as Record<string, string>)[
                                        `risk${row.riskLevel}`
                                      ] ?? row.riskLevel}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
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
                            {/* The currency next to the figure, because two of
                                them live in this table now. */}
                            <td className="whitespace-nowrap py-3 pr-4 text-xs text-muted-foreground">
                              {row.settledCurrency.toUpperCase()}
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
