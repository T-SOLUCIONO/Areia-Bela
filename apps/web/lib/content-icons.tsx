'use client'

import {
  Baby,
  Bath,
  Bike,
  Building2,
  Bus,
  Car,
  ChefHat,
  Coffee,
  Dumbbell,
  Fan,
  Flame,
  Gamepad2,
  Gift,
  Heart,
  Home,
  Key,
  Laptop,
  Leaf,
  MapPin,
  Martini,
  Music,
  Palmtree,
  PawPrint,
  Refrigerator,
  Shield,
  ShieldCheck,
  Ship,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Thermometer,
  Trees,
  Tv,
  Umbrella,
  UtensilsCrossed,
  Users,
  Waves,
  Wifi,
  Wind,
  WashingMachine,
} from 'lucide-react'

/**
 * A curated set rather than all of lucide: the host picks from what suits a
 * beach house, and nobody has to know that the icon is called "PawPrint".
 * Adding one here is the only way to make it available, which keeps the
 * landing page from drifting into a random icon soup.
 */
export const CONTENT_ICONS = {
  Users,
  Waves,
  PawPrint,
  Gamepad2,
  Wifi,
  Coffee,
  Umbrella,
  Sun,
  Palmtree,
  Trees,
  Leaf,
  Home,
  Key,
  MapPin,
  Bike,
  Car,
  Bus,
  // The boardwalk at John's Pass; the coast is half of what this house sells.
  Ship,
  Building2,
  ShoppingBag,
  UtensilsCrossed,
  ChefHat,
  Refrigerator,
  Martini,
  Bath,
  WashingMachine,
  Snowflake,
  Thermometer,
  Flame,
  Fan,
  Wind,
  Tv,
  Laptop,
  Music,
  Dumbbell,
  Baby,
  Heart,
  Gift,
  Sparkles,
  Star,
  Shield,
  ShieldCheck,
} as const

export type ContentIconName = keyof typeof CONTENT_ICONS

export function isContentIcon(name: string): name is ContentIconName {
  return name in CONTENT_ICONS
}

/** Renders a stored icon name; nothing if the name is blank or unknown. */
export function ContentIcon({ name, className }: { name: string; className?: string }) {
  if (!isContentIcon(name)) return null
  const Icon = CONTENT_ICONS[name]
  return <Icon className={className} aria-hidden />
}
