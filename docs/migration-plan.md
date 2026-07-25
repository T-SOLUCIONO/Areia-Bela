# Plan de migración — Areia Bela

Reglas generales: ver `CLAUDE.md`. Cada fase requiere aprobación explícita antes
de empezar. Ninguna fase avanza sin cumplir su criterio de salida.

## Fase 1 — Auditoría ✅ completada

Ver `docs/current-analysis.md`. Decisiones tomadas: casa única (no hotel), bilingüe ES/EN.

## Fase 2 — Monorepo + limpieza de dominio + base bilingüe (EN CURSO)

- Crear Turborepo: `apps/web`, `apps/api` (placeholder), `packages/{ui,types,shared,utils,config}`.
- Mover el frontend actual a `apps/web` sin romper el sitio.
- Eliminar progresivamente código de dominio "hotel": rooms, room-card, room availability, housekeeping, channel manager.
- Eliminar duplicados detectados en la auditoría (BookingWidget×2, ContactSection×2, useIsMobile×2, use-toast×2, `yarn.lock` vs `pnpm-lock.yaml`).
- Unificar el motor de precios (`buildQuote` en `lib/booking.ts`) como única fuente; eliminar `services/pricing.ts` legacy o fusionarlo.
- Quitar `typescript.ignoreBuildErrors: true`. Configurar ESLint + Prettier + Husky + Commitlint.
- Crear `packages/types/src/domain/{property,booking,customer,pricing,extra,availability,cms}.ts`.
- Preparar routing bilingüe `app/[locale]/...` (aún sin CMS conectado).
- **No implementar todavía:** Stripe completo, reservas reales contra DB, auth final, migración completa del CMS.

**Criterio de salida:** `pnpm install && pnpm build && pnpm lint && pnpm typecheck` sin errores. Sitio actual sigue funcionando igual para el usuario final.

## Fase 3 — Backend NestJS + PostgreSQL + Prisma

- `apps/api` con Prisma, schema inicial (`Property`, `Availability`, `Booking`, `Customer`, `Extra`, `PriceRule`), migraciones, seed.
- Seed con datos reales de Areia Bela (no ficticios) — ver `docs/domain-decisions.md`.
- Endpoint `POST /properties/areia-bela/quote` que reemplaza el cálculo client-side.
- Docker Compose local con PostgreSQL.
- Documentar base de datos + diagrama ER en `docs/database.md`.

**Criterio de salida:** el quote server-side coincide con la UI actual; seed corre limpio desde cero.

## Fase 4 — Autenticación

- JWT + refresh tokens + Argon2 + RBAC.
- Proteger `/admin/*` con middleware Next.js + guards NestJS.
- CRUD usuarios/roles/permisos, protección contra fuerza bruta.

## Fase 5 — CMS / Admin

- Migrar a DB: settings, hero, footer, SEO, FAQs, políticas, todas las secciones descritas en `docs/domain-decisions.md`, en `es` y `en`.
- Galería con upload + reorder + optimización de imágenes.
- CRUD de Extras/Servicios (piscina, niñera, mascota, huésped extra).
- Dashboard con datos reales.

## Fase 6 — Sistema de reservas

- Calendario tipo Airbnb (2 meses, hover range, fechas bloqueadas desde API) para **una sola propiedad**.
- Validación de conflictos, mínimo de noches, temporada de piscina climatizada.
- Flujo completo: quote → hold → pay → confirm.

## Fase 7 — Stripe completo

- Webhooks (`checkout.session.completed`, `payment_intent.failed`).
- El `Booking` se crea en el webhook, nunca en el frontend.
- Reembolsos desde admin, panel de pagos.

## Fase 8 — Calidad y producción

- Tests unitarios (pricing, auth), integración (API), E2E Playwright (flujo de reserva completo).
- SEO técnico, accesibilidad WCAG AA, Lighthouse > 95.
- GitHub Actions CI/CD, Docker de producción, documentación de deployment.

## Quick wins previos a Fase 2 (hacer primero, son rápidos y bajan riesgo)

1. Rotar y revocar la Stripe key expuesta en `.env.backup`.
2. Quitar `.env.backup` del repo (y de su historial de git).
3. Eliminar `yarn.lock`, dejar solo `pnpm-lock.yaml`.
4. Desactivar `typescript.ignoreBuildErrors`.
5. Borrar componentes huérfanos identificados en la auditoría.
