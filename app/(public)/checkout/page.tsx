"use client";

import { Suspense, useState } from "react";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format, parseISO, subDays } from "date-fns";
import { Star, Shield, ShieldCheck, Clock, CreditCard, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { currency, getQuoteFromStorage, parseQuoteFromSearchParams, saveQuoteToStorage } from "@/lib/booking";
import { propertyData } from "@/lib/property-data";
import { createCheckoutSession } from "@/services/payment";

const guestLabel = (adults: number, children: number, infants: number, pets: number) => {
  const parts: string[] = [];
  const totalGuests = adults + children;
  parts.push(`${totalGuests} guest${totalGuests !== 1 ? "s" : ""}`);
  if (infants > 0) parts.push(`${infants} infant${infants !== 1 ? "s" : ""}`);
  if (pets > 0) parts.push(`${pets} pet${pets !== 1 ? "s" : ""}`);
  return parts.join(", ");
};

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteFromParams = useMemo(
    () => parseQuoteFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const [quote, setQuote] = useState(quoteFromParams);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
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

  if (!quote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 rounded-full border-4 border-[#FF385C] border-t-transparent animate-spin" />
          <p className="mt-4 text-[#717171]">Loading your reservation...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) return;
    
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const cancellationDate = format(subDays(parseISO(quote.checkIn), 5), "MMM d");
  const hasDiscount = quote.originalPricePerNight > quote.pricePerNight;
  const savings = hasDiscount ? (quote.originalPricePerNight - quote.pricePerNight) * quote.nights : 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Header 
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#ebebeb] bg-white px-6 md:px-12">
        <Link href="/" className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zm0 4a3 3 0 110 6 3 3 0 010-6zm0 22c-6.627 0-12-5.373-12-12h4c0 4.418 3.582 8 8 8s8-3.582 8-8h4c0 6.627-5.373 12-12 12z" fill="#FF385C"/>
          </svg>
          <span className="font-semibold text-xl text-[#222222]">areia bela</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm text-[#717171]">
            <Shield className="h-4 w-4 text-[#008A05]" />
            <span>Booking protected</span>
          </div>
        </div>
      </header>*/}

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-12">
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-[#717171] hover:text-[#222222] transition-colors">
          ← Back to listing
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left Column - Form */}
          <div className="lg:col-span-3 space-y-8">
            {/* Header Section */}
            <div className="border-b border-[#ebebeb] pb-6">
              <h1 className="text-2xl font-semibold text-[#222222]">Confirm and pay</h1>
            </div>

            {/* Property Card */}
            <div className="rounded-xl border border-[#ebebeb] p-5">
              <div className="flex gap-4">
                <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg">
                  <Image 
                    src={propertyData.photos[0].large} 
                    alt={propertyData.name} 
                    fill 
                    className="object-cover" 
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#222222]">{propertyData.name}</p>
                  <p className="text-sm text-[#717171] mt-1">{propertyData.city}, {propertyData.country}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Star className="h-4 w-4 fill-[#222222] text-[#222222]" />
                    <span className="font-medium text-[#222222]">{propertyData.rating.toFixed(2)}</span>
                    <span className="text-[#717171]">({propertyData.reviewsCount} reviews)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trip Details */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-[#222222]">Your trip</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#ebebeb] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#717171]">Dates</p>
                  <p className="mt-1 font-medium text-[#222222]">
                    {format(parseISO(quote.checkIn), "MMM d")} - {format(parseISO(quote.checkOut), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm text-[#717171]">{quote.nights} nights</p>
                </div>
                <div className="rounded-lg border border-[#ebebeb] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#717171]">Guests</p>
                  <p className="mt-1 font-medium text-[#222222]">
                    {guestLabel(quote.guests.adults, quote.guests.children, quote.guests.infants, quote.guests.pets)}
                  </p>
                </div>
              </div>
            </section>

            {/* Cancellation Policy */}
            <section className="rounded-xl border border-[#ebebeb] p-5 bg-[#fafafa]">
              <div className="flex items-start gap-4">
                <Clock className="h-6 w-6 text-[#717171] mt-0.5" />
                <div>
                  <p className="font-semibold text-[#222222]">Free cancellation</p>
                  <p className="text-sm text-[#717171] mt-1">
                    Cancel before {cancellationDate} for a partial refund. After that, cancel before check-in 
                    to get a 50% refund, minus the service fee.
                  </p>
                </div>
              </div>
            </section>

            {/* Message to Host */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-[#222222]">Message the host</h2>
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-full">
                  <Image src={propertyData.host.pictureUrl} alt={propertyData.host.name} fill className="object-cover" />
                </div>
                <div>
                  <p className="font-medium text-[#222222]">Hosted by {propertyData.host.firstName}</p>
                  <p className="text-sm text-[#717171]">Host since {propertyData.hostSinceYear}</p>
                </div>
              </div>
              <Textarea
                id="specialRequests"
                name="specialRequests"
                value={formData.specialRequests}
                onChange={handleInputChange}
                placeholder="Let the host know a little about yourself and why you're traveling..."
                rows={4}
                className="rounded-lg border-[#b0b0b0] resize-none"
              />
              <p className="text-sm text-[#717171]">
                By messaging the host, you agree to the host&apos;s house rules and the{" "}
                <Link href="#" className="underline">guest refund policy</Link>.
              </p>
            </section>

            {/* Guest Information */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-[#222222]">Guest information</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="firstName" className="text-sm font-medium text-[#222222]">First name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="rounded-lg border-[#b0b0b0]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName" className="text-sm font-medium text-[#222222]">Last name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="rounded-lg border-[#b0b0b0]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-sm font-medium text-[#222222]">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="rounded-lg border-[#b0b0b0]"
                  />
                  <p className="text-xs text-[#717171]">Confirmation will be sent to this email</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-sm font-medium text-[#222222]">Phone number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="rounded-lg border-[#b0b0b0]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country" className="text-sm font-medium text-[#222222]">Country/Region</Label>
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-[#b0b0b0] px-3 py-2 text-sm"
                  >
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Australia">Australia</option>
                    <option value="Germany">Germany</option>
                    <option value="France">France</option>
                    <option value="Spain">Spain</option>
                    <option value="Brazil">Brazil</option>
                  </select>
                </div>
              </form>
            </section>

            {/* Payment */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-[#222222]">Payment</h2>
              <div className="rounded-xl border border-[#ebebeb] p-5 bg-[#fafafa]">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="h-5 w-5 text-[#717171]" />
                  <span className="text-[#717171]">Credit or debit card</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Visa", "Mastercard", "Amex", "Discover"].map((brand) => (
                    <span key={brand} className="rounded-md border border-[#b0b0b0] bg-white px-3 py-1.5 text-xs font-medium text-[#222222]">{brand}</span>
                  ))}
                </div>
              </div>
              
              <div className="rounded-xl border border-[#ebebeb] p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium text-[#222222]">Total (USD)</span>
                  <span className="text-xl font-semibold text-[#222222]">{currency(quote.total)}</span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="agreeTerms"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="h-4 w-4 rounded border-[#b0b0b0] accent-[#FF385C]"
                    />
                    <label htmlFor="agreeTerms" className="text-sm text-[#717171]">
                      I agree to the <Link href="#" className="underline">Terms of Service</Link>,{" "}
                      <Link href="#" className="underline">Privacy Policy</Link>, and{" "}
                      <Link href="#" className="underline">Guest Refund Policy</Link>.
                    </label>
                  </div>
                </div>

                <Button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isLoading || !agreedToTerms}
                  className="mt-6 w-full h-14 rounded-lg bg-[#FF385C] hover:bg-[#E31C5F] text-white font-semibold text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <>Confirm and pay</>
                  )}
                </Button>
              </div>
            </section>

            {/* Security Note */}
            <div className="flex items-start gap-3 text-sm text-[#717171]">
              <ShieldCheck className="h-5 w-5 text-[#008A05] mt-0.5" />
              <p>
                Your booking is protected by <span className="font-medium text-[#222222]">AirCover</span>. 
                If there&apos;s a problem with your stay, we&apos;re here to help.
              </p>
            </div>
          </div>

          {/* Right Column - Price Card */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-xl border border-[#dddddd] bg-white p-6 shadow-lg">
              {/* Property Preview */}
              <div className="flex gap-4 pb-5 border-b border-[#ebebeb]">
                <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg">
                  <Image 
                    src={propertyData.photos[0].large} 
                    alt={propertyData.name} 
                    fill 
                    className="object-cover" 
                  />
                </div>
                <div>
                  <p className="font-medium text-[#222222] line-clamp-2">{propertyData.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3.5 w-3.5 fill-[#222222] text-[#222222]" />
                    <span className="text-sm font-medium">{propertyData.rating.toFixed(2)}</span>
                    <span className="text-sm text-[#717171]">({propertyData.reviewsCount})</span>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="py-5 border-b border-[#ebebeb] space-y-3">
                <div className="flex justify-between items-center">
                  <span className="underline text-[#222222]">
                    {currency(quote.pricePerNight)} x {quote.nights} nights
                  </span>
                  <span className="text-[#222222]">{currency(quote.subtotal)}</span>
                </div>
                
                {hasDiscount && savings > 0 && (
                  <div className="flex justify-between items-center text-[#1b5e20]">
                    <span className="underline">Weekly discount</span>
                    <span>-{currency(savings)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="underline text-[#222222]">Cleaning fee</span>
                  <span className="text-[#222222]">{currency(quote.cleaningFee)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="underline text-[#222222]">Service fee</span>
                  <span className="text-[#222222]">{currency(quote.serviceFee)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="underline text-[#222222]">Taxes & fees</span>
                  <span className="text-[#222222]">{currency(quote.taxes)}</span>
                </div>
              </div>

              {/* Total */}
              <div className="pt-5">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-[#222222]">Total (USD)</span>
                  <span className="text-xl font-semibold text-[#222222]">{currency(quote.total)}</span>
                </div>
              </div>

              {/* Cancellation Policy in Card */}
              <div className="mt-5 p-4 rounded-lg bg-[#fafafa]">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-[#717171] mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#222222]">Free cancellation</p>
                    <p className="text-sm text-[#717171] mt-1">
                      Cancel before {cancellationDate} for a partial refund.
                    </p>
                  </div>
                </div>
              </div>

              {/* Price Tip */}
              {hasDiscount && savings > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-[#d4edda] flex items-start gap-2">
                  <Info className="h-4 w-4 text-[#1b5e20] mt-0.5" />
                  <p className="text-sm text-[#1b5e20]">
                    You&apos;re saving <span className="font-semibold">{currency(savings)}</span> with this discount!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 rounded-full border-4 border-[#FF385C] border-t-transparent animate-spin" />
          <p className="mt-4 text-[#717171]">Loading checkout...</p>
        </div>
      </div>
    }>
      <CheckoutForm />
    </Suspense>
  );
}
