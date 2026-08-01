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

## Fase 4 — Autenticación ✅ completada

- JWT + refresh tokens + Argon2 + RBAC.
- Proteger `/admin/*` con middleware Next.js + guards NestJS.
- CRUD usuarios/roles/permisos, protección contra fuerza bruta.
- **2FA (TOTP)** con códigos de recuperación — añadido a pedido del usuario,
  no estaba en el alcance original de esta fase.
- Decisión: rol como enum (`SUPERADMIN`/`MANAGER`/`VIEWER`) en vez de tablas
  `Role`/`Permission`, ya que `docs/domain-decisions.md` fija esos tres roles.

**Criterio de salida:** login real contra Postgres; `/admin/*` inaccesible sin
sesión válida; refresh rotado (reusar el anterior falla) y 2FA verificable de
punta a punta; cero credenciales demo en el código; `pnpm build`, `pnpm lint`,
`pnpm typecheck` y `pnpm test` en verde. Ver `docs/changelog.md` §14 para la
auditoría del checklist de seguridad.

## Fase 5 — CMS / Admin

- Migrar a DB: settings, hero, footer, SEO, FAQs, políticas, todas las secciones descritas en `docs/domain-decisions.md`, en `es` y `en`.
- Galería con upload + reorder + optimización de imágenes.
- CRUD de Extras/Servicios (piscina, niñera, mascota, huésped extra).
- Dashboard con datos reales.

**Criterio de salida**: el contenido del sitio (secciones, FAQs, fotos, SEO,
contacto) se edita desde `/admin` sin desplegar y el sitio de huéspedes lo
renderiza en el servidor; los ajustes de la casa y los extras se guardan de
verdad; ninguna pantalla del panel muestra cifras inventadas —lo que no tiene
datos lo dice; `pnpm build/lint/typecheck/test` en verde.

**Estado: completada** (ver `docs/changelog.md` §19). Diferido y declarado: la
copia de marketing de la portada sigue en `lib/i18n.ts`, la optimización de
imágenes pasa a Fase 8 y aplicar tarifas por temporada a una cotización es
Fase 6.

## Fase 6 — Sistema de reservas

- Calendario tipo Airbnb (2 meses, hover range, fechas bloqueadas desde API) para **una sola propiedad**. ✅
- Validación de conflictos, mínimo de noches, temporada de piscina climatizada. ✅
- Flujo completo: quote → hold → pay → confirm. ✅

**Criterio de salida:** dos peticiones simultáneas por la misma semana dejan
exactamente una reserva; un `hold` vencido devuelve sus noches al calendario;
el `Booking` pasa a `CONFIRMED` solo con un webhook de Stripe firmado, nunca
desde el navegador; la anfitriona ve las reservas y puede cancelarlas desde
`/admin/reservations`; `pnpm build/lint/typecheck/test` en verde.

**Cumplido** en `docs/changelog.md` §29 a §36. Queda pendiente del usuario una
sola cosa para que el flujo corra de punta a punta sin intervención:
`STRIPE_WEBHOOK_SECRET` con un valor real (ver `docs/env.md`).

## Fase 7 — Stripe completo

- Webhooks (`checkout.session.completed`, `payment_intent.failed`) — **los dos
  primeros se adelantaron en Fase 6.3**, junto con `checkout.session.expired`.
  Ver `docs/changelog.md` §29.
- El `Booking` se crea en el webhook, nunca en el frontend — **hecho en 6.3**.
- Reembolsos desde admin, panel de pagos.

## Fase 7.5 — Impuestos (módulo de recaudación y declaración)

Pedido por el usuario: un módulo en `/admin` que haga lo que hace Stripe Tax
—decir cuánto se debe y con qué desglose— porque **en una reserva directa la
anfitriona recauda y declara ella misma**, no una plataforma.

Contexto que ya existe: `Property.taxesPercent` está en 13 %, que es la suma
correcta para el condado de Pinellas (6 % estatal + 1 % del condado + 6 % de
turismo). Cada `Booking` guarda ya el importe cobrado en su columna `taxes`, así
que los datos para el informe están.

Alcance:

- **Desglose por jurisdicción.** Hoy hay un solo porcentaje. Declarar exige
  separar lo estatal (Florida DOR) de lo del condado (Pinellas Tax Collector),
  porque se remiten por separado y con calendarios distintos. Implica una tabla
  de tasas con vigencia por fecha: cambiar el porcentaje no debe reescribir lo
  ya cobrado.
- **Informe por periodo**: cuánto se recaudó en un mes o trimestre, por
  jurisdicción, con las reservas que lo componen. Exportable a CSV para el
  contador.
- **Marcar un periodo como declarado**, con fecha y referencia del pago, para
  que se vea qué falta remitir.
- **Excluir lo que no toca**: las reservas canceladas y los reembolsos no se
  declaran, y un reembolso parcial reduce la base.

Decisión abierta, para confirmar con un contador antes de escribir código:
**si la tarifa de limpieza forma parte de la base imponible.** El motor hoy
aplica los porcentajes solo al alojamiento; en Florida la limpieza de un
alquiler de corta estancia suele contar como parte de la contraprestación. Si
entra, es un cambio de una línea en `computeQuote` — y afecta a lo que se cobra,
así que no se toca sin confirmación.

**Criterio de salida:** la anfitriona puede abrir un mes, ver cuánto debe a cada
jurisdicción, exportarlo y marcarlo como declarado; las cifras cuadran con la
suma de las columnas `taxes` de las reservas de ese periodo.

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
