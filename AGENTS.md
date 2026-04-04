# Agent Instructions for Areia Bela

## Project Overview

Areia Bela is a Next.js 16 vacation rental booking application with:
- **Public booking site** at `/` with room listings and checkout
- **Admin dashboard** at `/admin` for managing reservations, housekeeping, channels
- **Stripe integration** for payments
- **Spanish/Portuguese localization** (huéspedes, noches, etc.)
- **Oklch color palette** with Tailwind CSS v4
- **Shadcn/ui** (New York style) + Radix primitives

---

## Build Commands

```bash
# Development
pnpm dev          # Start dev server (use pnpm, not npm)

# Production
pnpm build        # Build for production
pnpm start        # Start production server

# Code Quality
pnpm lint         # ESLint check
```

**Important**: This project uses `pnpm` as package manager, not npm or yarn.

---

## TypeScript Configuration

- **Strict mode enabled** (`tsconfig.json` has `strict: true`)
- **Path alias**: `@/*` maps to `./*`
- Module resolution: `bundler`
- JSX: `react-jsx`

---

## Code Style Guidelines

### File Organization

```
/app              # Next.js App Router pages and API routes
/components      # React components
  /ui             # Shadcn/ui primitives (button, dialog, calendar, etc.)
  /admin          # Admin-specific components
  /booking        # Booking flow components
  /public         # Public-facing components
  /contact        # Contact section components
  /rooms          # Room display components
/lib              # Utility functions and business logic
  utils.ts        # cn() helper (clsx + tailwind-merge)
  booking.ts      # Booking quote, serialization, storage helpers
  property-data.ts # Static property/pricing data
  mock-data.ts    # Sample data for development
/services         # External service integrations (Stripe, pricing)
/hooks            # Custom React hooks
/types            # TypeScript type definitions
```

### Imports

```typescript
// Use path aliases
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Room, Reservation } from "@/types";

// Order: 1) React, 2) external libs, 3) internal modules
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `BookingWidget`, `RoomCard` |
| Hooks | camelCase with `use` prefix | `useIsMobile`, `useToast` |
| Types/Interfaces | PascalCase | `Room`, `BookingQuote`, `GuestCounts` |
| Enums | PascalCase | `ReservationStatus`, `RoomType` |
| Utility functions | camelCase | `buildQuote`, `serializeQuoteToSearchParams` |
| CSS classes | kebab-case tailwind | `bg-primary`, `text-foreground/80` |

### Component Patterns

**Client Components** (useState, hooks, event handlers):
```tsx
"use client";

import { useState } from "react";
// ...

export function BookingWidget({ className }: { className?: string }) {
  // component code
}
```

**Server Components** (default - no "use client" directive):
```tsx
import type { Metadata } from 'next'
// ...

export const metadata: Metadata = { ... }

export default function Page() {
  // component code
}
```

### Type Definitions

```typescript
// Use interfaces for object shapes
export interface Room {
  id: string
  type: RoomType
  name: string
  // ...
}

// Use type aliases for unions, mapped types, utility types
export type RoomType = 'standard' | 'deluxe' | 'family-suite' | 'luxury-suite' | 'penthouse' | 'casa'

// Export types explicitly
export type { Room, Reservation }
export type { GuestCounts }  // Named exports
```

### Error Handling

```typescript
// Prefer try-catch with specific error handling
try {
  const data = JSON.parse(raw);
  if (!data.required) return null;
  return data;
} catch {
  return null;  // Silently handle parse errors
}

// For localStorage checks
if (typeof window === "undefined") return null;

// Always check for undefined values
const value = searchParams.get("key");
if (!value || Number.isNaN(Number(value))) return null;
```

### Styling

- Use Tailwind CSS with **oklch colors** from design tokens
- Use `cn()` for conditional classes: `cn("base", condition && "conditional", className)`
- Use `@/components/ui` for shadcn primitives
- Color reference in `app/globals.css`:
  - `--primary`, `--secondary`, `--muted`, `--accent`
  - `--destructive`, `--success`, `--warning`
  - `--border`, `--input`, `--ring`
  - Dark mode via `.dark` class on `<html>`

### Data Patterns

**Currency formatting**:
```typescript
export const currency = (value: number) => `$${value.toLocaleString("en-US")}`;
```

**Date handling**:
```typescript
import { format, parseISO, differenceInCalendarDays } from "date-fns";
const formatted = format(parseISO(isoDate), "d MMM yyyy");
const nights = differenceInCalendarDays(parseISO(end), parseISO(start));
```

**LocalStorage**:
```typescript
const STORAGE_KEY = "my_key_v1";

export function saveToStorage(data: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
```

---

## Environment Variables

Environment variables are prefixed with:
- `NEXT_PUBLIC_` for client-side accessible values
- No prefix for server-side only

Required variables (see `.env`):
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`

Never commit `.env` files; they are gitignored.

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` 16 | React framework |
| `react` 19, `react-dom` 19 | UI library |
| `@radix-ui/*` | Headless UI primitives |
| `shadcn/ui` | Styled components |
| `tailwindcss` v4 | Styling |
| `zod` | Schema validation |
| `react-hook-form` | Form handling |
| `date-fns` | Date utilities |
| `stripe` / `@stripe/stripe-js` | Payments |
| `recharts` | Charts |
| `sonner` | Toast notifications |

---

## Git Workflow

1. Create feature branches from `main`
2. Use conventional commit messages (optional but recommended)
3. Never commit `.env`, `.env.local`, or node_modules
4. The `.next` build folder is gitignored
