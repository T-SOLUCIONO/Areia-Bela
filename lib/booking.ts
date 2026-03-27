import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { propertyData } from "@/lib/property-data";

export type GuestCounts = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export type PriceLine = { label: string; value: number };

export type BookingQuote = {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: GuestCounts;
  pricePerNight: number;
  originalPricePerNight: number;
  extras: Array<{ id: string; label: string; pricePerNight: number; total: number }>;
  subtotal: number;
  extrasTotal: number;
  cleaningFee: number;
  serviceFee: number;
  taxes: number;
  total: number;
};

export const getNights = (checkIn: string, checkOut: string) =>
  Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)));

export function buildQuote(input: {
  checkIn: string;
  checkOut: string;
  guests: GuestCounts;
  selectedExtraIds: string[];
}): BookingQuote {
  const nights = getNights(input.checkIn, input.checkOut);
  const pricePerNight = propertyData.pricing.price_per_night;
  const originalPricePerNight = propertyData.pricing.original_price_per_night;
  const subtotal = pricePerNight * nights;
  const selectedExtras = propertyData.pricing.extras.filter((extra) =>
    input.selectedExtraIds.includes(extra.id),
  );
  const extras = selectedExtras.map((extra) => ({
    id: extra.id,
    label: extra.label,
    pricePerNight: extra.price_per_night,
    total: extra.price_per_night * nights,
  }));
  const extrasTotal = extras.reduce((acc, extra) => acc + extra.total, 0);
  const cleaningFee = propertyData.pricing.cleaning_fee;
  const serviceFee = Math.round(subtotal * (propertyData.pricing.service_fee_percent / 100));
  const taxes = Math.round(subtotal * (propertyData.pricing.taxes_percent / 100));
  const total = subtotal + extrasTotal + cleaningFee + serviceFee + taxes;

  return {
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights,
    guests: input.guests,
    pricePerNight,
    originalPricePerNight,
    extras,
    subtotal,
    extrasTotal,
    cleaningFee,
    serviceFee,
    taxes,
    total,
  };
}

export function serializeQuoteToSearchParams(quote: BookingQuote) {
  const params = new URLSearchParams({
    checkin: quote.checkIn,
    checkout: quote.checkOut,
    nights: String(quote.nights),
    adults: String(quote.guests.adults),
    children: String(quote.guests.children),
    infants: String(quote.guests.infants),
    pets: String(quote.guests.pets),
    pricePerNight: String(quote.pricePerNight),
    originalPricePerNight: String(quote.originalPricePerNight),
    subtotal: String(quote.subtotal),
    extrasTotal: String(quote.extrasTotal),
    cleaningFee: String(quote.cleaningFee),
    serviceFee: String(quote.serviceFee),
    taxes: String(quote.taxes),
    total: String(quote.total),
    extras: encodeURIComponent(JSON.stringify(quote.extras)),
  });

  return params.toString();
}

export function parseQuoteFromSearchParams(searchParams: URLSearchParams): BookingQuote | null {
  const checkIn = searchParams.get("checkin");
  const checkOut = searchParams.get("checkout");
  const nights = Number(searchParams.get("nights"));
  const adults = Number(searchParams.get("adults"));
  const children = Number(searchParams.get("children"));
  const infants = Number(searchParams.get("infants"));
  const pets = Number(searchParams.get("pets"));
  const pricePerNight = Number(searchParams.get("pricePerNight"));
  const originalPricePerNight = Number(searchParams.get("originalPricePerNight"));
  const subtotal = Number(searchParams.get("subtotal"));
  const extrasTotal = Number(searchParams.get("extrasTotal"));
  const cleaningFee = Number(searchParams.get("cleaningFee"));
  const serviceFee = Number(searchParams.get("serviceFee"));
  const taxes = Number(searchParams.get("taxes"));
  const total = Number(searchParams.get("total"));
  const extrasRaw = searchParams.get("extras");

  if (!checkIn || !checkOut || Number.isNaN(nights) || Number.isNaN(total) || !extrasRaw) {
    return null;
  }

  const extras = JSON.parse(decodeURIComponent(extrasRaw)) as BookingQuote["extras"];

  return {
    checkIn,
    checkOut,
    nights,
    guests: { adults, children, infants, pets },
    pricePerNight,
    originalPricePerNight,
    extras,
    subtotal,
    extrasTotal,
    cleaningFee,
    serviceFee,
    taxes,
    total,
  };
}

const BOOKING_QUOTE_STORAGE_KEY = "booking_quote_v1";

export function saveQuoteToStorage(quote: BookingQuote) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOOKING_QUOTE_STORAGE_KEY, JSON.stringify(quote));
}

export function getQuoteFromStorage(): BookingQuote | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BOOKING_QUOTE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingQuote;
    if (!parsed.checkIn || !parsed.checkOut || !parsed.nights) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const currency = (value: number) => `$${value.toLocaleString("en-US")}`;
export const shortDate = (iso: string) => format(parseISO(iso), "MMM d, yyyy");

