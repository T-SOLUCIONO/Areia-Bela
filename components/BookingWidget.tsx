"use client";

import { useMemo, useState } from "react";
import { addDays, format, subDays } from "date-fns";
import { ChevronDown, Keyboard, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildQuote, currency, saveQuoteToStorage, serializeQuoteToSearchParams, type GuestCounts } from "@/lib/booking";
import { propertyData } from "@/lib/property-data";

type Props = { className?: string };

const getGuestSummary = (guests: GuestCounts) => {
  const total = guests.adults + guests.children;
  const parts = [`${total} ${total === 1 ? "huésped" : "huéspedes"}`];
  if (guests.infants > 0) parts.push(`${guests.infants} ${guests.infants === 1 ? "infante" : "infantes"}`);
  return parts.join(", ");
};

export function BookingWidget({ className }: Props) {
  const router = useRouter();
  const today = new Date();
  const [checkIn, setCheckIn] = useState<Date | undefined>(addDays(today, 7));
  const [checkOut, setCheckOut] = useState<Date | undefined>(addDays(today, 10));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isGuestsOpen, setIsGuestsOpen] = useState(false);
  const [guests, setGuests] = useState<GuestCounts>({ adults: 1, children: 0, infants: 0, pets: 0 });
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const checkInIso = checkIn ? format(checkIn, "yyyy-MM-dd") : "";
  const checkOutIso = checkOut ? format(checkOut, "yyyy-MM-dd") : "";
  const quote = useMemo(
    () => buildQuote({ checkIn: checkInIso, checkOut: checkOutIso, guests, selectedExtraIds: selectedExtras }),
    [checkInIso, checkOutIso, guests, selectedExtras],
  );

  const canReserve = quote.nights > 0 && guests.adults + guests.children > 0;
  const hasDiscount = quote.originalPricePerNight > quote.pricePerNight;

  const updateGuest = (key: keyof GuestCounts, delta: 1 | -1) => {
    setGuests((prev) => {
      const next = Math.max(0, prev[key] + delta);
      if (key === "adults" && next < 1) return prev;
      return { ...prev, [key]: next };
    });
  };

  const reserve = () => {
    if (!canReserve) return;
    saveQuoteToStorage(quote);
    router.push(`/checkout?${serializeQuoteToSearchParams(quote)}`);
  };

  return (
    <aside className={`rounded-xl border border-border bg-background p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] ${className ?? ""}`}>
      <div className="mb-5">
        <div className="flex items-end gap-2">
          {hasDiscount ? <span className="text-lg text-foreground/60 line-through">{currency(quote.originalPricePerNight)}</span> : null}
          <span className="text-2xl font-semibold">{currency(quote.pricePerNight)}</span>
          <span className="pb-0.5 text-sm text-foreground/80">por {quote.nights || 0} noches</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="grid w-full grid-cols-2 text-left">
              <div className="border-r border-border p-3">
                <p className="text-[10px] font-bold uppercase">Llegada</p>
                <p className="text-sm text-foreground/80">{checkIn ? format(checkIn, "d MMM yyyy") : "Agregar fecha"}</p>
              </div>
              <div className="p-3">
                <p className="text-[10px] font-bold uppercase">Salida</p>
                <p className="text-sm text-foreground/80">{checkOut ? format(checkOut, "d MMM yyyy") : "Agregar fecha"}</p>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-2">
              <Calendar
                mode="range"
                selected={{ from: checkIn, to: checkOut }}
                numberOfMonths={1}
                onSelect={(range) => {
                  setCheckIn(range?.from);
                  setCheckOut(range?.to);
                }}
                disabled={{ before: today }}
                initialFocus
              />
              <div className="flex items-center justify-between px-3 pb-2 text-xs">
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setCheckIn(undefined);
                    setCheckOut(undefined);
                  }}
                >
                  Borrar fechas
                </button>
                <span className="inline-flex items-center gap-1 text-foreground/70">
                  <Keyboard className="h-3.5 w-3.5" />
                  Teclado
                </span>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="border-t border-border p-3">
          <button type="button" onClick={() => setIsGuestsOpen((prev) => !prev)} className="flex w-full items-center justify-between">
            <span>
              <p className="text-[10px] font-bold uppercase">Huéspedes</p>
              <p className="text-sm text-foreground/80">{getGuestSummary(guests)}</p>
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isGuestsOpen ? "rotate-180" : ""}`} />
          </button>
          {isGuestsOpen ? (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              {(
                [
                  { key: "adults", label: "Adultos" },
                  { key: "children", label: "Niños" },
                  { key: "infants", label: "Infantes" },
                  { key: "pets", label: "Mascotas" },
                ] as const
              ).map((item) => (
                <div key={item.key} className="flex items-center justify-between py-1">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => updateGuest(item.key, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center text-sm">{guests[item.key]}</span>
                    <Button type="button" variant="outline" size="icon-sm" className="rounded-full" onClick={() => updateGuest(item.key, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-full bg-muted px-3 py-2 text-xs text-foreground/80">
        Cancelación gratuita antes del {checkIn ? format(subDays(checkIn, 2), "d MMM yyyy") : "tu llegada"}
      </div>

      <Button onClick={reserve} disabled={!canReserve} className="mt-4 h-12 w-full rounded-lg bg-[#E31C5F] text-base font-semibold text-white hover:bg-[#D70466]">
        Reservar
      </Button>
      <p className="mt-2 text-center text-sm text-foreground/70">Aún no se te cobrará nada</p>

      {quote.nights > 0 ? (
        <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
          <div className="flex justify-between">
            <span>{quote.nights} noches x {currency(quote.pricePerNight)}</span>
            <span>
              {hasDiscount ? <span className="mr-1 text-foreground/60 line-through">{currency(quote.originalPricePerNight * quote.nights)}</span> : null}
              {currency(quote.subtotal)}
            </span>
          </div>
          <div className="flex justify-between"><span>Tarifa de limpieza</span><span>{currency(quote.cleaningFee)}</span></div>
          <div className="flex justify-between"><span>Tarifa de servicio</span><span>{currency(quote.serviceFee)}</span></div>
          <div className="flex justify-between"><span>Impuestos</span><span>{currency(quote.taxes)}</span></div>
          {propertyData.pricing.extras.map((extra) => {
            const checked = selectedExtras.includes(extra.id);
            return (
              <label key={extra.id} className="flex items-center justify-between gap-3 py-1">
                <span>{extra.label} (+{currency(extra.price_per_night)}/noche)</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setSelectedExtras((prev) => (checked ? prev.filter((id) => id !== extra.id) : [...prev, extra.id]))}
                />
              </label>
            );
          })}
          <div className="h-px bg-border" />
          <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{currency(quote.total)}</span></div>
        </div>
      ) : null}
    </aside>
  );
}
