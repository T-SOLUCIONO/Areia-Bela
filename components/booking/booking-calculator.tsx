"use client";

import { useMemo, useState } from "react";
import { addDays, format, subDays } from "date-fns";
import { useRouter } from "next/navigation";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildQuote, currency, type GuestCounts, serializeQuoteToSearchParams } from "@/lib/booking";
import { propertyData } from "@/lib/property-data";

type Props = { className?: string };

const totalGuests = (guests: GuestCounts) => guests.adults + guests.children;
const guestSummary = (guests: GuestCounts) => {
  const mainGuests = totalGuests(guests);
  const guestLabel = `${mainGuests} ${mainGuests === 1 ? "huésped" : "huéspedes"}`;
  if (guests.infants > 0) {
    return `${guestLabel}, ${guests.infants} ${guests.infants === 1 ? "infante" : "infantes"}`;
  }
  return guestLabel;
};

export function BookingCalculator({ className }: Props) {
  const router = useRouter();
  const today = new Date();
  const [checkIn, setCheckIn] = useState(format(addDays(today, 7), "yyyy-MM-dd"));
  const [checkOut, setCheckOut] = useState(format(addDays(today, 10), "yyyy-MM-dd"));
  const [guests, setGuests] = useState<GuestCounts>({ adults: 2, children: 0, infants: 0, pets: 0 });
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [isGuestOpen, setIsGuestOpen] = useState(false);

  const quote = useMemo(
    () => buildQuote({ checkIn, checkOut, guests, selectedExtraIds: selectedExtras }),
    [checkIn, checkOut, guests, selectedExtras],
  );

  const isValid = quote.nights > 0 && totalGuests(guests) > 0;

  const updateGuest = (key: keyof GuestCounts, delta: 1 | -1) => {
    setGuests((prev) => {
      const next = Math.max(0, prev[key] + delta);
      if (key === "adults" && next === 0 && prev.children === 0) {
        return prev;
      }
      return { ...prev, [key]: next };
    });
  };

  const reserve = () => {
    if (!isValid) return;
    router.push(`/checkout?${serializeQuoteToSearchParams(quote)}`);
  };

  return (
    <aside className={`rounded-xl border border-border bg-background p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] ${className ?? ""}`}>
      <div className="mb-5 flex items-end justify-between">
        <div className="flex items-end gap-2">
          <p className="text-xl text-foreground/60 line-through">{currency(quote.originalPricePerNight)}</p>
          <p className="text-2xl font-semibold">{currency(quote.pricePerNight)}</p>
          <p className="pb-0.5 text-sm text-foreground/80">por {quote.nights || 0} noches</p>
        </div>
        <p className="text-sm text-foreground/70">{propertyData.reviewsCount} reseñas</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-2">
          <label className="border-r border-border p-3 text-sm">
            <span className="mb-1 block text-[10px] font-bold uppercase text-foreground">Llegada</span>
            <input className="w-full bg-transparent text-sm outline-none" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </label>
          <label className="p-3 text-sm">
            <span className="mb-1 block text-[10px] font-bold uppercase text-foreground">Salida</span>
            <input className="w-full bg-transparent text-sm outline-none" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
        </div>
        <div className="border-t border-border p-3">
          <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setIsGuestOpen((prev) => !prev)}>
            <span>
              <span className="mb-1 block text-[10px] font-bold uppercase text-foreground">Huéspedes</span>
              <span className="text-sm text-foreground/80">{guestSummary(guests)}</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-foreground/70 transition-transform ${isGuestOpen ? "rotate-180" : ""}`} />
          </button>
          {isGuestOpen && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              {(
                [
                  { key: "adults", label: "Adultos" },
                  { key: "children", label: "Niños" },
                  { key: "infants", label: "Infantes" },
                  { key: "pets", label: "Mascotas" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-sm">{label}</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => updateGuest(key, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-4 text-center text-sm">{guests[key]}</span>
                    <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => updateGuest(key, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/70">Extras opcionales</p>
        {propertyData.pricing.extras.map((extra) => {
          const checked = selectedExtras.includes(extra.id);
          return (
            <label key={extra.id} className="flex cursor-pointer items-center justify-between gap-2 py-1.5 text-sm">
              <span>{extra.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-foreground/70">+{currency(extra.price_per_night)}/noche</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSelectedExtras((prev) => (checked ? prev.filter((id) => id !== extra.id) : [...prev, extra.id]))
                  }
                />
              </span>
            </label>
          );
        })}
      </div>

      <Button className="mt-4 h-12 w-full rounded-lg bg-[#E31C5F] text-base font-semibold text-white hover:bg-[#D70466]" onClick={reserve} disabled={!isValid}>
        Reservar
      </Button>

      <p className="mt-3 text-center text-sm text-foreground/70">Aún no se te cobrará nada</p>
      <p className="mt-1 text-center text-sm text-foreground/80">
        Cancelación gratuita antes del {format(subDays(new Date(checkIn), 2), "d MMM yyyy")}
      </p>

      <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
        <div className="flex justify-between">
          <span>
            {quote.nights} noches x {currency(quote.pricePerNight)}
          </span>
          <span>{currency(quote.subtotal)}</span>
        </div>
        {quote.extras.map((extra) => (
          <div key={extra.id} className="flex justify-between">
            <span>{extra.label}</span>
            <span>{currency(extra.total)}</span>
          </div>
        ))}
        <div className="flex justify-between">
          <span>Cleaning fee</span>
          <span>{currency(quote.cleaningFee)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tarifa de servicio ({propertyData.pricing.service_fee_percent}%)</span>
          <span>{currency(quote.serviceFee)}</span>
        </div>
        <div className="flex justify-between">
          <span>Impuestos ({propertyData.pricing.taxes_percent}%)</span>
          <span>{currency(quote.taxes)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
          <span>Total USD</span>
          <span>{currency(quote.total)}</span>
        </div>
      </div>
    </aside>
  );
}

