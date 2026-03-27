"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format, parseISO, subDays } from "date-fns";
import { ChevronLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { currency, getQuoteFromStorage, parseQuoteFromSearchParams, saveQuoteToStorage } from "@/lib/booking";
import { propertyData } from "@/lib/property-data";
import { createCheckoutSession } from "@/services/payment";

const guestLabel = (adults: number, children: number, infants: number, pets: number) => {
  const total = adults + children;
  const chunks = [`${total} ${total === 1 ? "huésped" : "huéspedes"}`];
  if (infants > 0) chunks.push(`${infants} ${infants === 1 ? "infante" : "infantes"}`);
  if (pets > 0) chunks.push(`${pets} ${pets === 1 ? "mascota" : "mascotas"}`);
  return chunks.join(", ");
};

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteFromParams = useMemo(
    () => parseQuoteFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const [quote, setQuote] = useState(quoteFromParams);

  const [isLoading, setIsLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "United States",
    specialRequests: "",
  });

  useEffect(() => {
    if (quoteFromParams) {
      setQuote(quoteFromParams);
      saveQuoteToStorage(quoteFromParams);
      return;
    }
    const persisted = getQuoteFromStorage();
    if (persisted) {
      setQuote(persisted);
      return;
    }
    router.replace("/");
  }, [quoteFromParams, router]);

  if (!quote) return <div className="p-10 text-center text-sm text-foreground/70">Cargando reservación...</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const session = await createCheckoutSession({
        roomId: propertyData.id,
        roomName: propertyData.name,
        roomType: "casa",
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        guests: quote.guests.adults + quote.guests.children,
        adults: quote.guests.adults,
        children: quote.guests.children,
        nights: quote.nights,
        nightPrice: quote.pricePerNight,
        cleaningFee: quote.cleaningFee,
        serviceFee: quote.serviceFee,
        taxes: quote.taxes,
        totalPrice: quote.total,
      });

      window.location.href = session.url;
    } catch (error) {
      console.error("Checkout error:", error);
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const cancellationDate = format(subDays(parseISO(quote.checkIn), 2), "d MMM yyyy");
  const datesText = `${format(parseISO(quote.checkIn), "d MMM yyyy")} - ${format(parseISO(quote.checkOut), "d MMM yyyy")}`;

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 lg:px-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-foreground/70 hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Volver
      </Link>

      <h1 className="mb-8 text-3xl font-semibold text-foreground">Solicitar reservación</h1>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div>
        <section className="border-b border-border py-8">
            <h2 className="mb-2 text-xl font-semibold">Escribe un mensaje para el anfitrión</h2>
            <p className="mb-4 text-sm text-foreground/70">Comparte detalles de tu viaje y cualquier solicitud especial.</p>
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted">
                <Image src={propertyData.host.pictureUrl} alt={propertyData.host.name} fill className="object-cover" />
              </div>
              <p className="text-sm">
                <span className="font-semibold">{propertyData.host.name}</span>
                <span className="text-foreground/70"> · Anfitrión desde {propertyData.hostSinceYear}</span>
              </p>
            </div>
            <Textarea
              id="specialRequests"
              name="specialRequests"
              value={formData.specialRequests}
              onChange={handleInputChange}
              placeholder="Hola, viajo con mi familia y nos encantó tu casa..."
              rows={5}
              className="rounded-xl"
            />
          </section>

          <section className="py-8">
            <div className="mb-5 rounded-xl border border-border bg-muted/30 p-4 text-sm text-foreground/80">
              El anfitrión tiene 24 horas para confirmar tu solicitud...
            </div>
       
          </section>

          <section className="rounded-xl border border-border p-5">
            <h2 className="mb-4 text-xl font-semibold">Forma de pago</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {["Mastercard", "Amex", "Discover", "PayPal", "Google Pay"].map((brand) => (
                  <span key={brand} className="rounded-md border border-border px-2 py-1">{brand}</span>
                ))}
              </div>

              <Button
                type="submit"
                className="w-full h-14 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Redirecting to Stripe...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Book & Pay with Stripe
                  </>
                )}
              </Button>
            </form>
          </section>

         
        </div>

        <aside className="h-fit rounded-2xl border border-border p-6">
          <div className="flex gap-4">
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl">
              <Image src={propertyData.photos[0].large} alt={propertyData.name} fill className="object-cover" />
            </div>
            <div>
              <p className="line-clamp-2 text-sm font-semibold">{propertyData.name}</p>
              <p className="mt-1 text-sm text-foreground/70">★ {propertyData.rating.toFixed(1)} · {propertyData.reviewsCount} reseñas</p>
            </div>
          </div>

          <div className="my-5 h-px bg-border" />
          <div>
            <p className="font-semibold">Cancelación gratuita</p>
            <p className="text-sm text-foreground/70">Cancela antes del {cancellationDate} para obtener un reembolso parcial.</p>
            <button type="button" className="mt-1 text-sm underline">Política completa</button>
          </div>

          <div className="my-5 h-px bg-border" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Fechas</p>
              <p className="text-sm text-foreground/70">{datesText}</p>
            </div>
            <Button type="button" variant="outline" className="h-8 rounded-full px-4 text-xs">Modificar</Button>
          </div>

          <div className="my-5 h-px bg-border" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Participantes</p>
              <p className="text-sm text-foreground/70">{guestLabel(quote.guests.adults, quote.guests.children, quote.guests.infants, quote.guests.pets)}</p>
            </div>
            <Button type="button" variant="outline" className="h-8 rounded-full px-4 text-xs">Modificar</Button>
          </div>

          <div className="my-5 h-px bg-border" />
          <h3 className="mb-3 font-semibold">Detalles del precio</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>{quote.nights} noches x {currency(quote.pricePerNight)}</span>
              <span>
                <span className="mr-1 text-foreground/60 line-through">{currency(quote.originalPricePerNight * quote.nights)}</span>
                {currency(quote.subtotal)}
              </span>
            </div>
            <div className="flex justify-between"><span>Tarifa de limpieza</span><span>{currency(quote.cleaningFee)}</span></div>
            <div className="flex justify-between"><span>Tarifa de servicio</span><span>{currency(quote.serviceFee)}</span></div>
            <div className="flex justify-between"><span>Impuestos</span><span>{currency(quote.taxes)}</span></div>
            {quote.extrasTotal > 0 ? <div className="flex justify-between"><span>Extras</span><span>{currency(quote.extrasTotal)}</span></div> : null}
          </div>

          <div className="my-4 h-0.5 bg-border" />
          <div className="flex justify-between text-base font-semibold">
            <span>Total USD</span>
            <span>{currency(quote.total)}</span>
          </div>
          <button type="button" className="mt-2 text-sm underline">Desglose del precio</button>

          <div className="mt-5 rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
            El precio está por debajo del promedio para 60 días
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs text-foreground/60">
            <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            Tu reservación se procesa de forma segura.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="p-10 text-center text-sm">Cargando checkout...</div>}>
        <CheckoutForm />
      </Suspense>
    </div>
  );
}
