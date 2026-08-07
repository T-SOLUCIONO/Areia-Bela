'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  endOfMonth,
  endOfQuarter,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
} from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, Download, Info, Loader2, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent } from '@areia-bela/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@areia-bela/ui/dialog'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { apiFetch } from '@/lib/api-client'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'
import { Pagination, usePagination } from '@/components/admin/pagination'
import { cn } from '@/lib/utils'

interface Jurisdiction {
  id: string
  name: string
  authority: string
  percent: number
  collected: number
  refunded: number
  owed: number
  filing: { id: string; amount: number; filedAt: string; reference: string | null } | null
}

interface Stay {
  reference: string
  guestName: string
  paidAt: string
  checkIn: string
  checkOut: string
  taxableBase: number
  taxCharged: number
  taxRefunded: number
  effectivePercent: number
}

interface Report {
  from: string
  to: string
  jurisdictions: Jurisdiction[]
  stays: Stay[]
  totals: { collected: number; refunded: number; owed: number }
  ratesMismatch: boolean
  chargedPercent: number
}

type Period = 'thisMonth' | 'lastMonth' | 'quarter' | 'year'

const rangeFor = (period: Period) => {
  const now = new Date()
  if (period === 'lastMonth') {
    const previous = subMonths(now, 1)
    return { from: startOfMonth(previous), to: endOfMonth(previous) }
  }
  if (period === 'quarter') return { from: startOfQuarter(now), to: endOfQuarter(now) }
  if (period === 'year') return { from: startOfYear(now), to: now }
  return { from: startOfMonth(now), to: endOfMonth(now) }
}

/**
 * What the house owes, and to whom.
 *
 * Every figure comes from the bills as they were charged. Nothing is recomputed
 * at today's rate: a stay booked before a rate change collected the old one, and
 * declaring what it *would* cost now would declare money nobody took.
 */
export default function TaxesPage() {
  const { language, t } = useAdminLanguage()
  const copy = t.taxes
  const locale = language === 'en' ? enUS : esLocale

  const [period, setPeriod] = useState<Period>('thisMonth')
  const [report, setReport] = useState<Report | null>(null)
  const [failed, setFailed] = useState(false)
  const [loadedPeriod, setLoadedPeriod] = useState<Period | null>(null)
  const loading = loadedPeriod !== period

  const [filing, setFiling] = useState<Jurisdiction | null>(null)
  const [amount, setAmount] = useState('')
  const [filedAt, setFiledAt] = useState('')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (next: Period) => {
    const { from, to } = rangeFor(next)
    try {
      setReport(
        await apiFetch<Report>(
          `/taxes?from=${format(from, 'yyyy-MM-dd')}&to=${format(to, 'yyyy-MM-dd')}`,
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

  // Arriba de cualquier return temprano.
  // A year of stays is a long table; the CSV is what an accountant reads whole.
  const pagedStays = usePagination(report?.stays ?? [])

  const money = (value: number) =>
    value.toLocaleString(language === 'en' ? 'en-US' : 'es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const openFiling = (one: Jurisdiction) => {
    setFiling(one)
    // Pre-filled with what is owed and today's date, because that is the
    // common case; both stay editable, because the bank is the authority on
    // what actually left.
    setAmount(one.owed.toFixed(2))
    setFiledAt(format(new Date(), 'yyyy-MM-dd'))
    setReference(one.filing?.reference ?? '')
  }

  const saveFiling = async () => {
    if (!filing || !report) return
    setBusy(true)
    try {
      await apiFetch('/taxes/filings', {
        method: 'POST',
        body: JSON.stringify({
          jurisdictionId: filing.id,
          periodStart: report.from,
          periodEnd: report.to,
          amount: Number(amount),
          filedAt: new Date(filedAt).toISOString(),
          reference: reference.trim() || undefined,
        }),
      })
      toast.success(copy.filingSaved)
      setFiling(null)
      await load(period)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.filingFailed)
    } finally {
      setBusy(false)
    }
  }

  const undoFiling = async (id: string) => {
    try {
      await apiFetch(`/taxes/filings/${id}`, { method: 'DELETE' })
      toast.success(copy.filingRemoved)
      await load(period)
    } catch {
      toast.error(copy.filingFailed)
    }
  }

  const downloadCsv = () => {
    const { from, to } = rangeFor(period)
    const api = process.env.NEXT_PUBLIC_API_URL ?? ''
    // A plain navigation rather than a fetch: the browser handles the download
    // and the cookie rides along, so nothing has to be held in memory.
    window.open(
      `${api}/taxes/export?from=${format(from, 'yyyy-MM-dd')}&to=${format(to, 'yyyy-MM-dd')}`,
      '_blank',
    )
  }

  if (failed) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Receipt />
          </EmptyMedia>
          <EmptyTitle>{copy.title}</EmptyTitle>
          <EmptyDescription>{copy.loadFailed}</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => void load(period)}>
          {t.common.retry}
        </Button>
      </Empty>
    )
  }

  const declaredPercent = report?.jurisdictions.reduce((sum, one) => sum + one.percent, 0) ?? 0

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="max-w-2xl text-sm text-muted-foreground">{copy.lead}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['thisMonth', 'lastMonth', 'quarter', 'year'] as const).map((option) => (
            <Button
              key={option}
              variant={period === option ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(option)}
            >
              {copy[option]}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!report}>
            <Download className="h-4 w-4" />
            {copy.exportCsv}
          </Button>
        </div>
      </div>

      {loading || !report ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Money with no authority to be declared to is not a rounding
              problem, so it is not shown as one. */}
          {report.ratesMismatch && (
            <div className="flex items-start gap-3 rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{copy.mismatchTitle}</p>
                <p className="mt-0.5">
                  {fill(copy.mismatchBody, {
                    declared: String(declaredPercent),
                    charged: String(report.chargedPercent),
                  })}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={copy.collected} value={money(report.totals.collected)} />
            <Stat label={copy.refunded} value={money(report.totals.refunded)} muted />
            <Stat label={copy.owed} value={money(report.totals.owed)} hint={copy.owedLead} strong />
          </div>

          {report.jurisdictions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {copy.noJurisdictions}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {report.jurisdictions.map((one) => (
                <Card key={one.id}>
                  <CardContent className="space-y-3 py-5">
                    <div>
                      <p className="font-medium text-foreground">{one.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {one.percent}% · {copy.authority}: {one.authority}
                      </p>
                    </div>

                    <dl className="space-y-1 border-t border-border pt-3 text-sm">
                      <Line label={copy.collected} value={money(one.collected)} />
                      {one.refunded > 0 && (
                        <Line label={copy.refunded} value={`− ${money(one.refunded)}`} />
                      )}
                      <div className="flex justify-between pt-1 font-semibold text-foreground">
                        <dt>{copy.owed}</dt>
                        <dd className="tabular-nums">{money(one.owed)}</dd>
                      </div>
                    </dl>

                    {one.filing ? (
                      <div className="flex items-start gap-2 rounded-[10px] bg-emerald-50 p-3 text-xs text-emerald-800 ring-1 ring-inset ring-emerald-200">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p>
                            {fill(copy.filedOn, {
                              date: format(parseISO(one.filing.filedAt), 'd MMM yyyy', { locale }),
                            })}
                            {' · '}
                            {money(one.filing.amount)}
                          </p>
                          {one.filing.reference && (
                            <p className="truncate">
                              {fill(copy.filedRef, { reference: one.filing.reference })}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => void undoFiling(one.filing!.id)}
                            className="mt-1 underline underline-offset-2"
                          >
                            {copy.undoFiling}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => openFiling(one)}
                      >
                        {copy.markFiled}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <p className="flex items-start gap-2 rounded-[12px] bg-muted/60 p-4 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {copy.disclaimer}
          </p>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.stays} · {report.stays.length}
            </h2>

            {report.stays.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  {copy.noStays}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[46rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">{copy.colReference}</th>
                        <th className="px-4 py-3 font-semibold">{copy.colGuest}</th>
                        <th className="px-4 py-3 font-semibold">{copy.colPaid}</th>
                        <th className="px-4 py-3 text-right font-semibold">{copy.colBase}</th>
                        <th className="px-4 py-3 text-right font-semibold">{copy.colTax}</th>
                        <th className="px-4 py-3 text-right font-semibold">{copy.colRate}</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          {copy.colTaxRefunded}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedStays.visible.map((stay) => {
                        const outlier =
                          Math.abs(stay.effectivePercent - report.chargedPercent) > 0.01
                        return (
                          <tr
                            key={stay.reference}
                            className="border-b border-border/60 last:border-0"
                          >
                            <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-foreground">
                              {stay.reference}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{stay.guestName}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                              {format(parseISO(stay.paidAt), 'd MMM', { locale })}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                              {money(stay.taxableBase)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-foreground">
                              {money(stay.taxCharged)}
                            </td>
                            {/* A rate the house no longer charges is not an
                                error to hide: the bill is frozen and this is
                                what was collected. */}
                            <td
                              className={cn(
                                'whitespace-nowrap px-4 py-3 text-right tabular-nums',
                                outlier ? 'font-medium text-amber-700' : 'text-muted-foreground',
                              )}
                              title={outlier ? copy.rateOutlier : undefined}
                            >
                              {stay.effectivePercent}%
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                              {stay.taxRefunded > 0 ? `− ${money(stay.taxRefunded)}` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 pb-3">
                  <Pagination
                    page={pagedStays.page}
                    pages={pagedStays.pages}
                    onPage={pagedStays.setPage}
                    firstShown={pagedStays.firstShown}
                    lastShown={pagedStays.lastShown}
                    total={pagedStays.total}
                  />
                </div>
              </Card>
            )}
          </section>
        </>
      )}

      <Dialog open={filing !== null} onOpenChange={(open) => !open && !busy && setFiling(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{fill(copy.filingTitle, { name: filing?.name ?? '' })}</DialogTitle>
            <DialogDescription>{copy.filingLead}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filing-amount">{copy.filingAmount}</Label>
              <Input
                id="filing-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{copy.filingAmountHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filing-date">{copy.filingDate}</Label>
              <Input
                id="filing-date"
                type="date"
                value={filedAt}
                onChange={(event) => setFiledAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filing-ref">{copy.filingReference}</Label>
              <Input
                id="filing-ref"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFiling(null)} disabled={busy}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => void saveFiling()}
              disabled={busy || amount === '' || filedAt === ''}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.filingSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
