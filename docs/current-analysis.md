# Auditoría inicial — Areia Bela (Fase 1)

Estado: análisis realizado en modo lectura (sin cambios en código). Base para las fases 2–8 del `docs/migration-plan.md`.

## 1. Resumen ejecutivo

Areia Bela es hoy un **prototipo frontend en Next.js 16** con UI premium parcialmente construida, datos estáticos/mock, admin decorativo y una integración Stripe mínima e insegura para producción. No existe backend, base de datos, autenticación real, tests ni pipeline DevOps.

El código modela parcialmente un **hotel multi-habitación** (rooms, penthouse, channel manager) cuando el producto real es una **casa vacacional única**. Esta inconsistencia ya fue resuelta como decisión de dominio — ver `docs/domain-decisions.md`.

| Dimensión        | Estado actual            | Objetivo                           |
| ---------------- | ------------------------ | ---------------------------------- |
| Frontend público | ~70% UI funcional        | Premium, SEO, reservas tipo Airbnb |
| Admin/CMS        | ~25% (shells + mock)     | CMS completo sin tocar código      |
| Backend          | No existe                | NestJS + PostgreSQL + Prisma       |
| Auth             | Login simulado           | JWT + RBAC + sesiones              |
| Pagos            | Checkout parcial         | Webhooks + reservas + reembolsos   |
| Tests/CI         | 0                        | Jest + Playwright + GitHub Actions |
| Seguridad        | Crítica en varios puntos | OWASP production-ready             |

## 2. Arquitectura actual

```
app/
  (public)/          → Sitio público (/, /checkout, /confirmation)
  admin/              → Panel admin (12 rutas, mayoría placeholder)
  api/checkout/       → Único endpoint backend
components/
  ui/                 → 56 componentes shadcn (varios sin uso)
  public/             → Hero, availability, header, footer
  booking/            → Widgets legacy (mayoría huérfanos)
  admin/              → Sidebar, charts, tablas mock
lib/                  → booking, mock-data, property-data, i18n
services/             → payment, reservations, pricing (simulados)
types/                → Tipos extensos (mezcla hotel + booking)
datos.json            → 1.252 líneas de listing Airbnb
```

### Stack real vs. objetivo

| Tecnología                                       | Actual                  | Objetivo      |
| ------------------------------------------------ | ----------------------- | ------------- |
| Next.js App Router                               | ✅ 16.1.6               | ✅            |
| TypeScript strict                                | ⚠️ build ignora errores | ✅ sin ignore |
| Tailwind v4 + shadcn                             | ✅                      | ✅            |
| React Hook Form + Zod                            | ⚠️ instaladas, poco uso | ✅            |
| Framer Motion / TanStack Query / Zustand / Axios | ❌                      | ✅            |
| NestJS + Prisma + PostgreSQL                     | ❌                      | ✅            |
| Jest / Playwright / Docker / CI                  | ❌                      | ✅            |

### Flujo de reservas actual (roto)

```
AvailabilityCard (hero) → buildQuote() desde property-data / datos.json
Quote serializado en URL + localStorage
/checkout lee el quote del cliente, sin revalidación server-side
POST /api/checkout crea Stripe Session con totalPrice del cliente
/confirmation muestra éxito desde localStorage, sin verificar el pago
```

Existe además un segundo motor de precios (`services/pricing.ts`, `calculatePrice`) con reglas distintas (temporadas, cupones, multi-room) que **nunca se usa** en el flujo principal.

## 3. Problemas detectados

### 🔴 Seguridad (crítico)

| Problema                          | Detalle                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `.env.backup` en git              | Contiene `STRIPE_SECRET_KEY` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` reales. Rotar de inmediato.                       |
| Admin sin auth                    | Login siempre redirige a `/admin`; password pre-rellenado; sin middleware de protección.                              |
| Manipulación de precios           | Totales viajan por query params + localStorage; el endpoint de Stripe confía en `bookingDetails.totalPrice` del body. |
| Sin webhooks Stripe               | No hay verificación de pago, idempotencia ni creación de reserva post-pago.                                           |
| Sin rate limiting / CSRF / Helmet | No hay middleware ni headers de seguridad.                                                                            |
| `ignoreBuildErrors: true`         | TypeScript no bloquea builds rotos.                                                                                   |

### 🟠 Deuda técnica

| Área                   | Problema                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Datos                  | Tres fuentes duplicadas: `datos.json`, `property-data.ts`, `mock-data.ts` (~2.100+ líneas)                                   |
| Dominio                | Casa única vs. hotel multi-room mezclados en tipos y admin                                                                   |
| Componentes duplicados | `BookingWidget` (×2), `ContactSection` (×2), `useIsMobile` (×2), `use-toast` (×2)                                            |
| Código muerto          | `booking-card`, `booking-calculator`, `booking-widget` (admin), `room-card`, `image-gallery`, `theme-provider` — sin imports |
| Lockfiles              | `pnpm-lock.yaml` + `yarn.lock` coexisten                                                                                     |
| ESLint                 | Script `"lint": "eslint ."` sin config asociada                                                                              |
| README                 | No existe                                                                                                                    |
| Homepage               | `"use client"` en la página entera (~560 líneas) — penaliza SEO y RSC                                                        |
| Imágenes               | `unoptimized: true` — Core Web Vitals degradados                                                                             |
| i18n                   | Mezcla inline + `lib/i18n.ts`, sin CMS                                                                                       |

### 🟡 Admin incompleto

- Placeholder "under construction": Reservations, Rooms, Guests, Housekeeping, Channels.
- Mock sin persistencia: Dashboard, Calendar, Pricing, Coupons, Maintenance, Reports, Settings (`handleSave` solo hace `setTimeout`).

### 🟡 Stripe (parcial)

✅ Checkout Session básico. ❌ Webhooks, Payment Intents, reembolsos, facturas, metadata validada, reserva en DB.

### Rendimiento

Homepage client-only con imágenes externas de `muscache.com`; ~56 componentes shadcn (~30+ probablemente sin uso); sin lazy loading estratégico; sin skeleton states consistentes en admin.

### Calidad / testing

0 tests, 0 CI/CD, 0 Docker, 0 Prettier/Husky/Commitlint.

## 4. Mapa de código duplicado

```
lib/booking.ts          → buildQuote()     ← Flujo ACTIVO (AvailabilityCard, checkout)
services/pricing.ts     → calculatePrice() ← Flujo LEGACY (booking-card huérfano)

components/public/availability-card.tsx  ← Widget ACTIVO en hero
components/BookingWidget.tsx             ← Duplicado, NO importado
components/booking/booking-widget.tsx    ← Variante admin, NO importada

components/ContactSection.tsx            ← USADO en page.tsx
components/contact/contact-section.tsx   ← Duplicado, NO importado

hooks/use-mobile.ts                      ← Duplicado exacto
components/ui/use-mobile.tsx
```

## 5. Priorización de quick wins (antes/durante Fase 2)

| #   | Acción                                                 | Impacto                    |
| --- | ------------------------------------------------------ | -------------------------- |
| 1   | Rotar y revocar Stripe keys expuestas en `.env.backup` | Seguridad crítica          |
| 2   | Quitar `.env.backup` del historial de git              | Seguridad                  |
| 3   | Eliminar `yarn.lock` (usar solo `pnpm`)                | Consistencia               |
| 4   | Desactivar `typescript.ignoreBuildErrors`              | Calidad                    |
| 5   | Borrar componentes huérfanos                           | Mantenibilidad             |
| 6   | Unificar fuente de datos de la propiedad               | DRY                        |
| 7   | Fijar dominio: casa única vs. hotel                    | Diseño de DB (ya resuelto) |

## 6. Riesgos del proyecto

| Riesgo                               | Mitigación                                                        |
| ------------------------------------ | ----------------------------------------------------------------- |
| Alcance grande (8 fases)             | Entregas incrementales; no avanzar sin criterio de salida         |
| Romper el flujo de reserva existente | Feature flags; mantener mock hasta que la API esté estable        |
| Inconsistencia de dominio            | Resuelto: 1 property, N blocked dates (ver `domain-decisions.md`) |
| Admin demasiado ambicioso de golpe   | CMS por módulos (settings → gallery → pages)                      |
| Stripe en producción sin webhooks    | Bloquear go-live hasta que la Fase 7 esté completa                |

## 7. Estimación global

| Fases                    | Duración estimada                           |
| ------------------------ | ------------------------------------------- |
| 2–3 (Monorepo + Backend) | 4–6 semanas                                 |
| 4–5 (Auth + CMS)         | 4–6 semanas                                 |
| 6–7 (Reservas + Stripe)  | 4–6 semanas                                 |
| 8 (QA + DevOps)          | 2–3 semanas                                 |
| **Total**                | **~14–21 semanas** (1 dev senior full-time) |

## 8. Decisiones ya tomadas a partir de esta auditoría

- Modelo de dominio: casa vacacional única (whole-home rental), no hotel. Ver `docs/domain-decisions.md`.
- Sitio bilingüe ES/EN desde el CMS.
- Próximo paso: ejecutar Fase 2 según `docs/migration-plan.md`.
