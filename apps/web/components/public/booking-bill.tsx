'use client'

import { fill } from '@areia-bela/shared'
import { currency } from '@/lib/booking'
import type { BookingBill } from '@/lib/guest-client'
import { translations, type Language } from '@/lib/i18n'

/**
 * The bill, line by line.
 *
 * Every figure comes off the booking as it was charged — not recomputed from
 * today's rates, which would quietly restate a stay bought last season at this
 * season's prices. A receipt that changes is not a receipt.
 */
export function BookingBillLines({
  bill,
  nights,
  language,
}: {
  bill: BookingBill
  nights: number
  language: Language
}) {
  const copy = translations[language].guestArea

  // A bill that does not add up to what was charged is worse than no bill.
  // Bookings taken before the breakdown was stored have zeros in these
  // columns, and showing "$0 + $0 + $0 = $1,245" would make a guest doubt the
  // charge rather than understand it.
  const sum =
    bill.nightsSubtotal -
    bill.weeklyDiscount +
    bill.extrasTotal +
    bill.additionalGuestFee +
    bill.cleaningFee +
    bill.serviceFee +
    bill.taxes
  const reconciles = Math.abs(sum - bill.total) < 0.02

  if (!reconciles) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.billTitle}
        </h3>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <span className="font-medium text-foreground">{copy.billTotal}</span>
          <span className="font-serif text-xl tabular-nums text-foreground">
            {currency(bill.total)}
          </span>
        </div>
      </div>
    )
  }

  const lines: Array<{ label: string; amount: number; negative?: boolean }> = [
    {
      label: `${copy.billNights} · ${fill(copy.nights, { count: String(nights) })}`,
      amount: bill.nightsSubtotal,
    },
  ]
  // Only what actually applied. A row of zeros reads as a charge you have to
  // check rather than one that never happened.
  if (bill.weeklyDiscount > 0) {
    lines.push({ label: copy.billDiscount, amount: -bill.weeklyDiscount, negative: true })
  }
  if (bill.additionalGuestFee > 0) {
    lines.push({ label: copy.billGuestFee, amount: bill.additionalGuestFee })
  }
  if (bill.extrasTotal > 0) lines.push({ label: copy.billExtras, amount: bill.extrasTotal })
  if (bill.cleaningFee > 0) lines.push({ label: copy.billCleaning, amount: bill.cleaningFee })
  if (bill.serviceFee > 0) lines.push({ label: copy.billService, amount: bill.serviceFee })
  if (bill.taxes > 0) lines.push({ label: copy.billTaxes, amount: bill.taxes })

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {copy.billTitle}
      </h3>
      <dl className="mt-3 space-y-2">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd
              className={
                line.negative ? 'tabular-nums text-emerald-700' : 'tabular-nums text-foreground'
              }
            >
              {line.negative ? '−' : ''}
              {currency(Math.abs(line.amount))}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
          <dt className="font-medium text-foreground">{copy.billTotal}</dt>
          <dd className="font-serif text-xl tabular-nums text-foreground">
            {currency(bill.total)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
