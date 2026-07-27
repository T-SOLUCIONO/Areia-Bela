# Agent Instructions for Areia Bela

> Domain rules, phase process and security requirements live in `CLAUDE.md`.
> This file covers repo structure and code conventions.

## Project Overview

Areia Bela is a **Turborepo monorepo** for a single whole-home vacation rental
(one reservable unit — **not** a hotel; see `CLAUDE.md`).

```
apps/
  web/    Next.js 16 (App Router) — public bilingual site + /admin dashboard
  api/    NestJS 11 + Prisma + PostgreSQL
packages/
  types/   domain types (packages/types/src/domain/*)
  shared/  business + auth constants, server-authoritative pricing
  ui/      55+ shadcn/ui primitives, consumed as @areia-bela/ui/<name>
  utils/   cn() and small helpers
  config/  shared tsconfig/eslint bases
```

- **Public site**: `apps/web/app/[locale]/(public)/` — bilingual ES/EN, locale
  driven by the URL segment (see `middleware.ts`).
- **Admin**: `apps/web/app/admin/` — protected by middleware + a server-side
  session check; JWT/Argon2/2FA live in `apps/api/src/auth/`.
- **Stripe** for payments; **Tailwind v4** with brand tokens in
  `apps/web/app/globals.css`.

---

## Build Commands

```bash
pnpm install      # pnpm only — not npm, not yarn
pnpm dev          # apps/web only
pnpm build
pnpm lint
pnpm typecheck
pnpm test         # jest in apps/api

# API (needs PostgreSQL: docker compose up -d postgres)
pnpm --filter @areia-bela/api dev              # port 3001
pnpm --filter @areia-bela/api prisma:migrate
pnpm --filter @areia-bela/api seed             # needs ADMIN_SEED_PASSWORD
```

**Important**: this project uses `pnpm`, and Turborepo drives the tasks above.

---

## TypeScript Configuration

- **Strict mode** everywhere; shared bases in `packages/config`.
- **Path alias**: `@/*` maps to the app root (e.g. `apps/web/*`).
- Workspace imports use the package name: `@areia-bela/ui/button`,
  `@areia-bela/shared`, `@areia-bela/types`.
- Prettier: no semicolons, single quotes.

---

## NestJS Conventions (apps/api)

One folder per feature — `properties/`, `auth/`, `users/` — each with
`X.module.ts`, `X.controller.ts`, `X.service.ts` and `dto/kebab-case.dto.ts`.

- DTOs use `class-validator` with definite assignment (`email!: string`).
- `PrismaModule` is `@Global()`, so `PrismaService` injects without importing.
- A global `ValidationPipe` runs with `whitelist` and `forbidNonWhitelisted`.
- **`JwtAuthGuard` is global**: every new endpoint is protected unless it opts
  out with `@Public()`. Role limits go through `@Roles(...)`.
- Prisma: `cuid()` ids, no `@map`, enums SCREAMING_SNAKE declared immediately
  above the model that uses them, `createdAt`/`updatedAt` only on entities with
  a lifecycle, composite indexes driven by real queries.

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
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Room, Reservation } from '@/types'

// Order: 1) React, 2) external libs, 3) internal modules
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
```

### Naming Conventions

| Type              | Convention                  | Example                                      |
| ----------------- | --------------------------- | -------------------------------------------- |
| Components        | PascalCase                  | `BookingWidget`, `RoomCard`                  |
| Hooks             | camelCase with `use` prefix | `useIsMobile`, `useToast`                    |
| Types/Interfaces  | PascalCase                  | `Room`, `BookingQuote`, `GuestCounts`        |
| Enums             | PascalCase                  | `ReservationStatus`, `RoomType`              |
| Utility functions | camelCase                   | `buildQuote`, `serializeQuoteToSearchParams` |
| CSS classes       | kebab-case tailwind         | `bg-primary`, `text-foreground/80`           |

### Component Patterns

**Client Components** (useState, hooks, event handlers):

```tsx
'use client'

import { useState } from 'react'
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
export type RoomType =
  'standard' | 'deluxe' | 'family-suite' | 'luxury-suite' | 'penthouse' | 'casa'

// Export types explicitly
export type { Room, Reservation }
export type { GuestCounts } // Named exports
```

### Error Handling

```typescript
// Prefer try-catch with specific error handling
try {
  const data = JSON.parse(raw)
  if (!data.required) return null
  return data
} catch {
  return null // Silently handle parse errors
}

// For localStorage checks
if (typeof window === 'undefined') return null

// Always check for undefined values
const value = searchParams.get('key')
if (!value || Number.isNaN(Number(value))) return null
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
export const currency = (value: number) => `$${value.toLocaleString('en-US')}`
```

**Date handling**:

```typescript
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
const formatted = format(parseISO(isoDate), 'd MMM yyyy')
const nights = differenceInCalendarDays(parseISO(end), parseISO(start))
```

**LocalStorage**:

```typescript
const STORAGE_KEY = 'my_key_v1'

export function saveToStorage(data: T) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
```

---

## Environment Variables

**`docs/env.md` is the full reference** — every variable by name and purpose,
for both apps. Copy the examples to get started:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Rules:

- `NEXT_PUBLIC_` prefix for client-readable values; no prefix for server-only.
- **Never commit `.env` files** — they are gitignored, and secrets are only ever
  documented by name.
- Secrets must not appear in `docs/`, comments, tests or commit messages.

---

## Key Dependencies

| Package                        | Purpose                |
| ------------------------------ | ---------------------- |
| `next` 16                      | React framework        |
| `react` 19, `react-dom` 19     | UI library             |
| `@radix-ui/*`                  | Headless UI primitives |
| `shadcn/ui`                    | Styled components      |
| `tailwindcss` v4               | Styling                |
| `zod`                          | Schema validation      |
| `react-hook-form`              | Form handling          |
| `date-fns`                     | Date utilities         |
| `stripe` / `@stripe/stripe-js` | Payments               |
| `recharts`                     | Charts                 |
| `sonner`                       | Toast notifications    |

---

## Git Workflow

1. Create feature branches from `main` (phase work: `fase-N-topic`).
2. **Conventional commits are enforced** — commitlint runs in a Husky
   `commit-msg` hook, so `tipo(scope): descripción` is mandatory, not optional.
   Commit subjects are written in Spanish; code comments in English.
3. `lint-staged` runs eslint + prettier on staged files via a `pre-commit` hook,
   so it may reformat what you staged — re-check the build after committing.
4. Never commit `.env`, `.env.local`, or node_modules.
5. `.next` and `dist` are gitignored.
