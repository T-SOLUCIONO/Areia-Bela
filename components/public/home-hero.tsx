"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Gamepad2,
  PawPrint,
  Users,
  Waves,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvailabilityCard } from "@/components/public/availability-card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { translations } from "@/lib/i18n";

type HeroProps = {
  images: string[];
};

const featureBadges = [
  { icon: Users },
  { icon: Waves },
  { icon: PawPrint },
  { icon: Gamepad2 },
  { icon: Wifi },
];

export function HomeHero({ images }: HeroProps) {
  const [index, setIndex] = useState(0);
  const total = images.length;
  const { language } = useLanguage();
  const copy = translations[language];

  useEffect(() => {
    if (total <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, 5500);

    return () => window.clearInterval(id);
  }, [total]);

  const slides = useMemo(() => images.slice(0, 5), [images]);

  return (
    <section className="relative isolate w-full overflow-hidden bg-[#f7f2ea] text-[#173a57]">
      <div className="absolute inset-0">
        {slides.map((src, slideIndex) => (
          <Image
            key={src}
            src={src}
            alt="Areia Bela beach stay"
            fill
            priority={slideIndex === 0}
            className={cn(
              "object-cover transition-opacity duration-1000 ease-in-out motion-reduce:transition-none",
              slideIndex === index
                ? "opacity-100 scale-100"
                : "opacity-0 scale-[1.04]",
            )}
            sizes="100vw"
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(247,242,234,0.98)_0%,rgba(247,242,234,0.76)_18%,rgba(247,242,234,0.24)_50%,rgba(247,242,234,0.08)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.58),transparent_24%),radial-gradient(circle_at_74%_20%,rgba(255,255,255,0.18),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,transparent_0%,rgba(247,242,234,0.12)_35%,rgba(247,242,234,0.9)_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-[1680px] flex-col px-4 pb-4 pt-4 sm:px-6 lg:px-8 xl:px-10 lg:pb-6 lg:pt-6">
        <div className="relative z-10 grid flex-1 items-center gap-10 pb-8 pt-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.78fr)] lg:items-center lg:gap-12 lg:pb-20 lg:pt-6 xl:gap-16">
          <div className="max-w-3xl space-y-5 pt-10 lg:pt-0">
            <h1 className="max-w-2xl font-serif text-[clamp(3.15rem,5.15vw,5.8rem)] leading-[0.92] tracking-tight text-[#173a57]">
              {copy.heroTitle[0]}
              <span className="block">{copy.heroTitle[1]}</span>
              <span
                className="mt-1 block italic text-[#2a5b84]"
                style={{ fontFamily: "'Areia Bela'", fontSize: "1.03em" }}
              >
                {copy.heroTitle[2]}
              </span>
            </h1>

            <p className="max-w-2xl text-[16px] leading-8 text-[#5d6b77]">
              {copy.heroDescription}
              <span className="mt-1 block">
                {copy.heroSubline}
              </span>
            </p>

            <Button
              asChild
              className="h-12 rounded-md bg-[#174d7a] px-6 text-sm font-semibold uppercase tracking-wide text-white shadow-none hover:bg-[#0f4068]"
            >
              <Link href="#reservar">
                {copy.heroCta}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div
            id="reservar"
            className="relative z-20 lg:justify-self-end lg:self-center lg:-translate-y-3"
          >
            <AvailabilityCard className="w-full max-w-[430px] border border-white/75 bg-white/95 shadow-[0_32px_100px_rgba(15,23,42,0.18)] backdrop-blur-xl" />
          </div>
        </div>

        <div className="relative z-10 mt-auto grid grid-cols-2 gap-3 pb-2 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {featureBadges.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={copy.featureBadges[index]}
                className="flex min-h-16 items-center gap-3 rounded-full border border-white/75 bg-white/85 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#174d7a]/10 text-[#174d7a]">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {copy.featureBadges[index]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
