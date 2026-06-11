"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronLeft, ChevronRight, Keyboard, Minus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildQuote, currency, saveQuoteToStorage, serializeQuoteToSearchParams, type GuestCounts } from "@/lib/booking";
import { propertyData } from "@/lib/property-data";
import { cn } from "@/lib/utils";

type Props = { className?: string };

const getGuestSummary = (guests: GuestCounts) => {
  const total = guests.adults + guests.children;
  const parts = [`${total} ${total === 1 ? "huésped" : "huéspedes"}`];
  if (guests.infants > 0) parts.push(`${guests.infants} ${guests.infants === 1 ? "bebé" : "bebés"}`);
  return parts.join(", ");
};

export function BookingWidget({ className }: Props) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [checkIn, setCheckIn] = useState<Date | undefined>(addDays(today, 7));
  const [checkOut, setCheckOut] = useState<Date | undefined>(addDays(today, 10));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isGuestsOpen, setIsGuestsOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(addDays(today, 7));
  const [guests, setGuests] = useState<GuestCounts>({ adults: 1, children: 0, infants: 0, pets: 0 });
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const guestWrapRef = useRef<HTMLDivElement>(null);

  const checkInIso = checkIn ? format(checkIn, "yyyy-MM-dd") : "";
  const checkOutIso = checkOut ? format(checkOut, "yyyy-MM-dd") : "";
  const quote = useMemo(
    () => buildQuote({ checkIn: checkInIso, checkOut: checkOutIso, guests, selectedExtraIds: selectedExtras }),
    [checkInIso, checkOutIso, guests, selectedExtras],
  );

  const canReserve = quote.nights > 0 && guests.adults + guests.children > 0;
  const selectedRange = checkIn ? { from: checkIn, to: checkOut } : undefined;

  useEffect(() => {
    if (isCalendarOpen) {
      setCalendarMonth(checkIn ?? addDays(today, 7));
    }
  }, [isCalendarOpen, checkIn, today]);

  useEffect(() => {
    if (!isGuestsOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!guestWrapRef.current?.contains(event.target as Node)) {
        setIsGuestsOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [isGuestsOpen]);

  const monthTitle = (month: Date) => format(month, "MMMM yyyy", { locale: es });
  const rangeSummary = checkIn && checkOut ? `${format(checkIn, "d 'de' MMM. 'de' yyyy", { locale: es })} - ${format(checkOut, "d 'de' MMM. 'de' yyyy", { locale: es })}` : "Selecciona tus fechas";
  const nightsLabel = `${quote.nights} noche${quote.nights === 1 ? "" : "s"}`;

  const formatRangeLabel = (date: Date | undefined, fallback: string, partialFallback?: string) => {
    if (!date) return fallback;
    if (!checkOut && partialFallback) return partialFallback;
    return format(date, "d/M/yyyy");
  };

  const clearDates = () => {
    setCheckIn(undefined);
    setCheckOut(undefined);
  };

  const handleRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    setCheckIn(range?.from);
    setCheckOut(range?.to);
    if (range?.from) {
      setCalendarMonth(range.from);
    }
  };

  const updateGuest = (key: keyof GuestCounts, delta: 1 | -1) => {
    setGuests((prev) => {
      const next = Math.max(0, prev[key] + delta);
      if (key === "adults" && next < 1) return prev;
      return { ...prev, [key]: next };
    });
  };

  const guestRows = [
    { key: "adults", title: "Adultos", description: "Más de 13 años" },
    { key: "children", title: "Niños", description: "De 2 a 12" },
    { key: "infants", title: "Bebés", description: "Menos de 2" },
  ] as const;

  const reserve = () => {
    if (!canReserve) return;
    saveQuoteToStorage(quote);
    router.push(`/checkout?${serializeQuoteToSearchParams(quote)}`);
  };

  return (
    <aside className={`rounded-xl border border-border bg-background p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] ${className ?? ""}`}>
      <div className="mb-6">
        <div className="flex items-end gap-2">
          <span className="text-[clamp(2rem,2.4vw,2.5rem)] font-semibold leading-none tracking-[-0.05em] text-[#222222] underline decoration-[2px] underline-offset-[3px]">{currency(quote.pricePerNight)}</span>
          <span className="pb-0.5 text-[clamp(1rem,1.2vw,1.25rem)] text-[#222222]">por {quote.nights || 0} noches</span>
        </div>
      </div>

      <div className="relative overflow-visible rounded-[28px] border border-[#bdbdbd] bg-white">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="grid w-full grid-cols-2 text-left">
              <div className="min-h-[105px] border-r border-b border-[#bdbdbd] px-5 py-4">
                <p className="text-[12px] font-bold uppercase tracking-[-0.02em] text-[#222222]">LLEGADA</p>
                <p className="mt-1.5 text-[clamp(1.35rem,1.7vw,1.8rem)] leading-none tracking-[-0.05em] text-[#222222]">{checkIn ? format(checkIn, "d/M/yyyy") : "Agregar fecha"}</p>
              </div>
              <div className="min-h-[105px] border-b border-[#bdbdbd] px-5 py-4">
                <p className="text-[12px] font-bold uppercase tracking-[-0.02em] text-[#222222]">SALIDA</p>
                <p className="mt-1.5 text-[clamp(1.35rem,1.7vw,1.8rem)] leading-none tracking-[-0.05em] text-[#222222]">{formatRangeLabel(checkOut, "Agregar fecha", "Selecciona salida")}</p>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(100vw-1rem,1280px)] rounded-[32px] border-border p-0 shadow-[0_24px_70px_rgba(0,0,0,0.12)]" align="center" sideOffset={12}>
            <div className="px-6 pt-7 md:px-10 md:pt-8">
              <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                  <div className="text-[clamp(2.25rem,3vw,3.2rem)] font-semibold tracking-[-0.05em] leading-none text-foreground">{nightsLabel}</div>
                  <div className="mt-3 text-[clamp(1rem,1.5vw,1.55rem)] leading-none text-[#717171]">{rangeSummary}</div>
                </div>

                <div className="grid grid-cols-2 rounded-[20px] border border-[#bdbdbd] overflow-hidden md:min-w-[530px]">
                  <div
                    className={cn(
                      "relative flex min-h-[110px] items-start justify-between gap-4 bg-background px-5 py-4 text-left transition",
                      "border-r border-[#bdbdbd]",
                      "border-2 border-[#222222]",
                    )}
                  >
                    <span>
                      <span className="block text-[13px] font-bold uppercase tracking-[-0.02em] text-[#222222]">LLEGADA</span>
                      <span className="mt-2 block text-[clamp(1.55rem,2vw,2rem)] leading-none tracking-[-0.05em] text-[#222222]">
                        {checkIn ? format(checkIn, "d/M/yyyy") : "Agregar fecha"}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label="Borrar llegada"
                      onClick={clearDates}
                      className="mt-1 shrink-0 text-[#222222]"
                    >
                      <X className="h-7 w-7" />
                    </button>
                  </div>
                  <div className="relative flex min-h-[110px] items-start justify-between gap-4 bg-background px-5 py-4 text-left transition">
                    <span>
                      <span className="block text-[13px] font-bold uppercase tracking-[-0.02em] text-[#222222]">SALIDA</span>
                      <span className="mt-2 block text-[clamp(1.55rem,2vw,2rem)] leading-none tracking-[-0.05em] text-[#222222]">
                        {checkOut ? format(checkOut, "d/M/yyyy") : "Agregar fecha"}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label="Borrar salida"
                      onClick={() => setCheckOut(undefined)}
                      className="mt-1 shrink-0 text-[#222222]"
                    >
                      <X className="h-7 w-7" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 pb-5 pt-10 md:px-10 md:pb-8">
              <Calendar
                mode="range"
                selected={selectedRange}
                numberOfMonths={2}
                min={1}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                onSelect={handleRangeSelect}
                locale={es}
                formatters={{
                  formatMonthCaption: (month) => monthTitle(month),
                  formatWeekdayName: (weekday) => format(weekday, "EEEEE", { locale: es }),
                }}
                disabled={{ before: today }}
                showOutsideDays
                fixedWeeks
                initialFocus
                className="bg-transparent p-0 [--cell-size:3.25rem] md:[--cell-size:4rem]"
                classNames={{
                  root: "w-full",
                  months: "grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16",
                  month: "w-full space-y-0",
                  nav: "absolute inset-x-0 top-[3.15rem] flex items-center justify-between px-2 md:px-3",
                  button_previous:
                    "grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent p-0 text-[#222222] shadow-none hover:bg-transparent hover:text-[#222222]",
                  button_next:
                    "grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent p-0 text-[#222222] shadow-none hover:bg-transparent hover:text-[#222222]",
                  month_caption: "flex h-10 items-center justify-center px-10 text-center",
                  caption_label: "text-[clamp(1.4rem,2vw,1.95rem)] font-semibold tracking-[-0.04em] text-[#222222]",
                  weekdays: "mb-8 flex w-full",
                  weekday: "flex-1 text-center text-[1rem] font-medium text-[#717171]",
                  week: "mt-0 flex w-full",
                  day: "relative flex aspect-square w-full items-center justify-center p-0 text-center",
                  today: "",
                  outside: "text-[#b0b0b0] opacity-100",
                  disabled: "text-[#d2d2d2] opacity-100",
                  hidden: "invisible",
                  range_start:
                    "z-10 rounded-full bg-[#222222] text-white shadow-[inset_0_0_0_2px_#222222,inset_0_0_0_4px_#ffffff]",
                  range_middle: "bg-[#f5f5f5] text-[#222222] rounded-none",
                  range_end: "z-10 rounded-full bg-[#222222] text-white",
                }}
                components={{
                  Chevron: ({ orientation, className }) =>
                    orientation === "left" ? (
                      <ChevronLeft className={cn("h-10 w-10", className)} />
                    ) : (
                      <ChevronRight className={cn("h-10 w-10", className)} />
                    ),
                }}
              />
              <div className="flex items-center justify-between gap-4 px-2 pt-5 text-xs md:px-3">
                <button
                  type="button"
                  className="font-medium text-[#717171] underline underline-offset-4"
                  onClick={clearDates}
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

        <div ref={guestWrapRef} className="relative">
          <button
            type="button"
            onClick={() => setIsGuestsOpen((prev) => !prev)}
            className={cn(
              "flex w-full items-center justify-between px-5 py-4 text-left transition",
              isGuestsOpen ? "border-x-2 border-b-0 border-t-2 border-[#222222]" : "border-t border-[#bdbdbd]",
            )}
          >
            <span>
              <p className="text-[12px] font-bold uppercase tracking-[-0.02em] text-[#222222]">HUÉSPEDES</p>
              <p className="mt-1 text-[clamp(1.35rem,1.7vw,1.8rem)] leading-tight tracking-[-0.04em] text-[#222222]">{getGuestSummary(guests)}</p>
            </span>
            <ChevronDown className={cn("h-7 w-7 text-[#222222] transition-transform", isGuestsOpen && "rotate-180")} />
          </button>

          {isGuestsOpen ? (
            <div className="w-full rounded-b-[24px] border-2 border-t-0 border-[#222222] bg-white px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
              <div className="space-y-6">
                {guestRows.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[24px] font-semibold leading-tight tracking-[-0.04em] text-[#222222]">{item.title}</p>
                      <p className="mt-1 text-[18px] leading-tight text-[#717171]">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-5">
                      <button
                        type="button"
                        aria-label={`Disminuir ${item.title}`}
                        disabled={guests[item.key] <= (item.key === "adults" ? 1 : 0)}
                        onClick={() => updateGuest(item.key, -1)}
                        className="grid size-14 place-items-center rounded-full bg-[#f2f2f2] text-[#bdbdbd] transition disabled:opacity-60 disabled:hover:bg-[#f2f2f2] enabled:text-[#222222] enabled:hover:bg-[#ebebeb]"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                      <span className="min-w-8 text-center text-[24px] leading-none tracking-[-0.04em] text-[#222222]">{guests[item.key]}</span>
                      <button
                        type="button"
                        aria-label={`Aumentar ${item.title}`}
                        onClick={() => updateGuest(item.key, 1)}
                        className="grid size-14 place-items-center rounded-full bg-[#f2f2f2] text-[#222222] transition hover:bg-[#ebebeb]"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
