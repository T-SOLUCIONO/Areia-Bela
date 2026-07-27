# Changelog — Fase 2: Monorepo + limpieza de dominio + base bilingüe

Estado: completada, en espera de aprobación para Fase 3. Rama: `fase-2-monorepo` (no
mergeada a `main`, nada pusheado). Nada de esto toca Stripe real, reservas contra DB,
auth final ni CMS — según lo acordado.

## 1. Quick wins de seguridad / limpieza

- `.env.backup` quitado del árbol de trabajo (`git rm --cached`) y añadido a
  `.gitignore`. Las claves que contenía son de **test** (`sk_test_`/`pk_test_`), no
  live — severidad menor de lo que sugería la auditoría, pero de todas formas no
  deben quedar en el historial.
  **Pendiente de decisión tuya:** el archivo sigue en commits anteriores del
  historial de `main`. Purgarlo (`git filter-repo` o similar) reescribe hashes de
  commits ya pusheados a `origin/main` — no lo hice sin tu ok explícito. Dime si
  quieres que lo haga y si hay que coordinar con quien tenga otros clones.
- `yarn.lock` eliminado; `pnpm-lock.yaml` como único lockfile.
- `typescript.ignoreBuildErrors: true` eliminado de `next.config.mjs`. Esto sacó a
  la luz 3 bugs de tipos reales que estaban silenciados (ver sección 6) — ya
  corregidos.
- Componentes huérfanos eliminados (cero imports en todo el repo, verificado con
  grep antes de borrar): `booking-calculator.tsx`, `booking-card.tsx`,
  `booking/booking-widget.tsx`, `BookingWidget.tsx`, `rooms/room-card.tsx`,
  `rooms/image-gallery.tsx`, `theme-provider.tsx`, `services/pricing.ts` (motor de
  precios legacy, solo lo usaba `booking-card.tsx`).
- Duplicados resueltos: `contact/contact-section.tsx` (se mantuvo
  `ContactSection.tsx`, que es el que de verdad se importa),
  `components/ui/use-mobile.tsx` y `components/ui/use-toast.ts` (se mantuvieron los
  de `hooks/`, que son los importados). `styles/globals.css` también eliminado —
  era una copia vieja (129 vs 159 líneas) que nada importaba; `app/globals.css` es
  el real.
- `.DS_Store` (6 archivos) sacados del repo y añadidos a `.gitignore`.

## 2. Turborepo

```
apps/
  web/      → sitio Next.js completo (antes en la raíz)
  api/      → placeholder vacío, solo package.json + README. Nada de NestJS
              todavía — eso es Fase 3.
packages/
  types/    → tipos de dominio nuevos (ver sección 5)
  utils/    → cn() real, apps/web/lib/utils.ts ahora re-exporta desde acá
  shared/   → constantes de negocio (capacidad, extras, penalizaciones) sacadas de
              domain-decisions.md — referencia para el seed de Fase 3, todavía no
              consumidas por apps/web (ver "diferido" abajo)
  config/   → tsconfig base compartido; apps/web y los demás packages lo extienden
  ui/       → los 55 primitivos shadcn/ui + hooks use-mobile/use-toast (ver sección 5b)
```

`pnpm-workspace.yaml` + `turbo.json` en la raíz. Scripts raíz (`dev`, `build`,
`lint`, `typecheck`) delegan a Turbo. `.env` se movió a `apps/web/.env` (Next.js
carga env vars relativas a la raíz de la app, no del monorepo — sin este cambio el
build rompía en `/api/checkout` por falta de `STRIPE_SECRET_KEY`).

## 3. Limpieza de dominio "hotel"

Eliminadas las 3 rutas admin que eran 100% placeholder sin ninguna lógica real:
`/admin/rooms`, `/admin/housekeeping`, `/admin/channels`, más sus entradas en
`admin-sidebar.tsx`.

**Diferido a Fase 5, decisión explícita:** `Dashboard`, `Reports`, `Calendar` y
`Pricing` siguen leyendo de `lib/mock-data.ts`, que todavía mezcla tipos hotel
(`RoomStats`, `Channel`, `HousekeepingTask`, etc.) con los de reserva real. No
reescribí esas pantallas en Fase 2 porque:

- Hoy funcionan (aunque sea con mock data) y romperlas sin reemplazo real
  contradice "el sitio sigue funcionando igual".
- Reescribirlas de verdad requiere datos reales, que es exactamente el alcance de
  Fase 5 ("Dashboard con datos reales") — hacerlo ahora es adelantar trabajo fuera
  de orden y con más riesgo de regresión.
- La auditoría (`current-analysis.md`) ya advertía sobre esto: "Admin demasiado
  ambicioso de golpe → CMS por módulos".

`types/index.ts` (en `apps/web/`) sigue teniendo el mix hotel/booking por la misma
razón — se irá vaciando página por página en Fase 5, no de un tirón.

## 4. Motor de precios

Ya estaba unificado de hecho: `buildQuote()` en `lib/booking.ts` es la única ruta
activa (hero → checkout). El motor legacy (`services/pricing.ts`) solo lo
consumía el componente huérfano `booking-card.tsx` — al borrar ambos en la
limpieza de quick wins, la unificación quedó resuelta sin tocar la lógica de
precios que sí está en producción.

## 5. `packages/types/src/domain/`

7 archivos (`property`, `booking`, `customer`, `pricing`, `extra`, `availability`,
`cms`) modelando el dominio real según `domain-decisions.md`: una sola `Property`,
`Extra` con las 4 reglas de negocio (piscina climatizada por temporada, niñera por
hora, huésped extra, mascota), `BlockedDate` en vez de inventario de habitaciones,
`CMSPage` con los 12 slugs del seed planeado, `Locale = 'es' | 'en'`. Son tipos
nuevos para Fase 3+ (Prisma, API) — **todavía no reemplazan** a `apps/web/types/index.ts`,
que sigue siendo lo que usa la UI actual.

## 5b. `packages/ui`

Migración completa (decidiste hacerla ahora en vez de diferirla): los 55 archivos
de `components/ui/` + `hooks/use-mobile.ts` + `hooks/use-toast.ts` se movieron a
`packages/ui/src/`. Import boundary verificado antes de mover (ningún archivo fuera
de `components/ui/` importaba esos hooks directamente, así que el corte es limpio).

- Sin barrel export — cada primitivo se importa por subpath
  (`@areia-bela/ui/button`, `@areia-bela/ui/hooks/use-toast`), igual que antes con
  `@/components/ui/button`. Mismo patrón, misma razón: un barrel forzaría a
  cargar los 55 componentes en cualquier bundle que use uno solo.
- `package.json` con `exports` map (`"./*"`, `"./hooks/*"`) para que TypeScript y
  Turbopack resuelvan los subpaths.
- Todas las dependencias de runtime que antes vivían sueltas en
  `apps/web/package.json` (los 27 paquetes `@radix-ui/*`, `class-variance-authority`,
  `cmdk`, `embla-carousel-react`, `input-otp`, `next-themes`, `react-day-picker`,
  `react-hook-form`, `@hookform/resolvers`, `react-resizable-panels`, `sonner`,
  `vaul`, `zod`) se movieron a `packages/ui/package.json`. `lucide-react` y
  `recharts` quedaron en **ambos** — se usan también fuera de `ui/` (iconos en
  todo el sitio, gráficos de admin en `components/admin/charts/*`).
- **No limpié** `apps/web/package.json` de las dependencias que ya no importa
  directamente (por ejemplo `zod`, que ahora solo usa `packages/ui/form.tsx`).
  Dejarlas de más no rompe nada; quitarlas mal sí. Es cosmético, queda para un
  pase de housekeeping si te interesa.
- Reescritura de imports en ~30 archivos de `apps/web` (sed, verificado que no
  quedó ningún `@/components/ui/` ni `@/hooks/use-mobile`/`use-toast` colgante).
- Verificado de nuevo el criterio completo: `pnpm build/lint/typecheck` en 0
  (lint bajó de 46 a 43 warnings porque `carousel.tsx` y `use-mobile.ts` ya no
  los cubre el eslint config de `apps/web` — quedan fuera de su alcance de lint
  hasta que `packages/ui` tenga su propio `eslint.config.mjs`, que no configuré
  todavía). Smoke test con `next start` sobre `/`, `/checkout`, `/admin`,
  `/admin/coupons` (usa Dialog/Select/Table migrados) y `/admin/reservations`
  (usa Sidebar migrado) → 200 en todos.

## 6. Bugs de tipos que aparecieron al quitar `ignoreBuildErrors`

3 bugs reales, preexistentes, ocultos por el flag:

- `admin/coupons/page.tsx` tipaba el state como `Coupon[]` pero los datos eran
  `AdminCoupon[]` (dos interfaces distintas en `types/index.ts` con forma
  distinta) → corregido el tipo.
- `admin/maintenance/page.tsx` mismo problema con `MaintenanceTask` vs
  `AdminMaintenanceTask`.
- `components/admin/charts/channel-chart.tsx` leía `d.channel` de un objeto
  `ChannelStats` que en realidad tiene `channelName` (typo preexistente, el
  gráfico de canales probablemente rendía "undefined" en el nombre) → corregido.

## 7. ESLint + Prettier + Husky + Commitlint

No existía ninguna config antes (el script `lint` llamaba a un ESLint sin
configurar — la auditoría ya lo señalaba). Ahora:

- `apps/web/eslint.config.mjs` usa el flat config nativo de `eslint-config-next`
  16 (`core-web-vitals` + `typescript`) — sin `FlatCompat`, que rompía con un
  `TypeError: Converting circular structure to JSON` contra `eslint-plugin-react`
  moderno.
- Prettier configurado (`semi: false`, `singleQuote: true`) siguiendo el estilo que
  ya domina en el repo (componentes shadcn). **No corrí un `prettier --write`
  global** — eso generaría un diff enorme mezclado con los cambios estructurales de
  esta fase; queda como comando disponible (`pnpm format`) para un pase dedicado.
- Husky + lint-staged + commitlint (conventional commits) configurados. El hook
  `pre-commit` corre `lint-staged`; `commit-msg` corre `commitlint`. Se activan
  solos vía el script `prepare` cuando alguien corre `pnpm install` (ya se
  ejecutó una vez en esta sesión y quedaron activos).
- `eslint-plugin-react-hooks` v7 (viene con `eslint-config-next` 16) trae reglas
  nuevas de "React Compiler readiness". Corregí las triviales
  (`react/no-unescaped-entities`, `@typescript-eslint/no-explicit-any` en
  `/api/checkout`, un `Math.random()` impuro en `sidebar.tsx` reescrito con
  `useState` lazy). **Diferí `react-hooks/set-state-in-effect`** (bajado a
  warning, no silenciado) porque dispara en 6 archivos con patrones legítimos de
  sync a estado externo (`matchMedia`, `localStorage`, callbacks de Embla
  Carousel) — arreglarlos bien implica reescribir esos efectos (candidatos a
  `useSyncExternalStore`), con riesgo real de romper el selector de idioma o el
  carrusel. Queda para Fase 8 (Calidad), visible como warning mientras tanto.

## 8. Routing bilingüe `app/[locale]/...`

Solo el grupo público (`(public)`) se movió bajo `app/[locale]/` — admin y
`/api/checkout` quedan fuera del prefijo (un panel interno no necesita URL por
idioma). `middleware.ts` reescribe internamente cualquier ruta pública sin prefijo
al locale por defecto (detectado por `Accept-Language`, mismo criterio que ya usaba
`LanguageProvider`) — la URL que ve el usuario no cambia (`/`, `/checkout`, etc.
siguen siendo esas rutas, no `/en/checkout`). `LanguageProvider` (el selector de
idioma client-side actual) no se tocó y sigue controlando el texto visible
exactamente igual que antes; el segmento `[locale]` es infraestructura para que
Fase 5 pueda hacer fetch de `CMSPage` por idioma vía route params, todavía no está
conectado a nada de contenido.

Verificado con build (`generateStaticParams` generó `/es` y `/en` estáticos
correctamente) y con smoke test manual (`/`, `/checkout`, `/admin`, `/es` → 200).

## 9. Verificación — criterio de salida

```
pnpm install   ✅
pnpm build     ✅ (0 errores)
pnpm lint      ✅ (0 errores, 46 warnings — no-unused-vars preexistentes +
                   6 react-hooks/set-state-in-effect diferidos, ver sección 7)
pnpm typecheck ✅ (0 errores)
```

Smoke test manual con `next start`: `/`, `/checkout`, `/admin`, `/es` responden
200; el contenido de la home renderiza igual que antes del cambio.

## 10. Decisiones tomadas en la revisión (2026-07-24)

Confirmaste las 4 preguntas pendientes:

1. **Purgar `.env.backup` del historial de git** → sí. Ver sección 11 (hecho
   localmente, force-push a `origin` pendiente de tu confirmación final antes de
   ejecutarlo, por ser una operación compartida/irreversible).
2. **Rotar las claves de test de Stripe** → sí, pero es una acción manual tuya en
   el dashboard de Stripe (no tengo acceso a tu cuenta). Cuando tengas las nuevas
   claves, decime y actualizo `apps/web/.env`.
3. **Migrar `packages/ui` ahora, antes de Fase 3** → hecho, ver sección 5b.
4. **Arrancar Fase 3 ahora** → sí, empezada (ver sección 12 en cuanto la cierre).

## 11. Purga de `.env.backup` del historial

Hecho localmente con `git filter-branch --index-filter 'git rm --cached
--ignore-unmatch .env.backup' --prune-empty -- --branches` sobre las 3 ramas
locales (`main`, `stagin`, `fase-2-monorepo`) — **no toqué `refs/remotes/origin/*`**,
así que el remoto no cambió todavía.

- Solo un commit tocaba el archivo (`d7cb043 "env"`), y era el único diff entre
  el historial viejo y el nuevo (verificado con `git diff` rama vieja vs nueva:
  únicamente `.env.backup | 2 --`, nada más se movió).
- Antes de correr `filter-branch` hice `git stash push -u` para no perder los
  cambios sin commitear de esta fase (`filter-branch` necesita árbol de trabajo
  limpio); los recuperé con `git stash pop` al terminar y verifiqué que el
  `typecheck` seguía en verde después del round-trip.
- `refs/original/*` (backup que crea `filter-branch` por si hay que revertir) y
  el reflog se purgaron con `git gc --prune=now --aggressive` — el blob viejo ya
  no está en el object store local **excepto** a través de
  `refs/remotes/origin/*`, que siguen apuntando al historial real de `origin`
  hasta que se haga push.
- **No hice `git push --force`.** Los hashes de commit cambiaron en las 3 ramas
  reescritas — pushear esto reemplaza el historial de `origin/main` (y
  `origin/stagin`) para cualquiera que tenga otro clone o PRs abiertos contra los
  hashes viejos. Coordino con vos el momento exacto antes de ejecutarlo.

Quedo esperando tu confirmación explícita para el `push --force` (afecta
`origin/main`, compartido) antes de ejecutarlo.

## 12. Fase 3 — Backend NestJS + PostgreSQL + Prisma

Ver `docs/database.md` para el detalle completo (diagrama ER, decisiones de
modelado, y la limitación de entorno explicada abajo). Resumen:

- `apps/api`: NestJS 11 real (no placeholder) — `PrismaModule` global,
  `PropertiesModule` con `POST /properties/:slug/quote` (DTO validado con
  `class-validator`).
- `prisma/schema.prisma`: exactamente los modelos que pide la Fase 3
  (`Property`, `BlockedDate` como `Availability`, `Booking`, `Customer`,
  `Extra`, `PriceRule`) + `BookingExtra` como join table. **Sin `User`/`Role`
  ni tablas de CMS** — siguen fuera de alcance (Fase 4 y 5).
- Migración inicial generada de verdad con
  `prisma migrate diff --from-empty --to-schema-datamodel ... --script`
  (no escrita a mano) — el mismo SQL que `prisma migrate dev` produciría
  contra una DB real.
- `packages/shared/src/pricing.ts`: `computeQuote()`, réplica pura (sin DB) de
  `buildQuote()`. Verificación real y ejecutada de que ambos coinciden:
  `apps/web/scripts/verify-quote-parity.ts` corre las dos funciones con los
  mismos 4 casos y los mismos datos reales — 4/4 verde (ver sección 5 de
  `docs/database.md` para la salida completa).
- `docker-compose.yml` con Postgres 16 + healthcheck, `apps/api/.env.example`.
- `docs/database.md` con diagrama ER (mermaid) y las decisiones de modelado
  (por qué `PriceRule` solo tiene la tarifa base sembrada, por qué
  `cleaningFee`/fees viven en `Property`, etc.)

**Actualización — cerrado de verdad contra Postgres real:** nos diste
credenciales de una instancia accesible desde este entorno
(`127.0.0.1:5432`). Con eso: `prisma migrate deploy` aplicó la migración
generada, `prisma/seed.ts` corrió dos veces sin error (upsert idempotente,
datos verificados por consulta directa), y levanté el servidor Nest real
(`ts-node --transpile-only src/main.ts`) para pegarle al endpoint con `curl` —
`total: 1700` (con `heated-pool`) y `total: 1620` (sin extras), **los mismos
números exactos** que ya había confirmado `verify-quote-parity.ts` de forma
aislada. 404 para propiedad inexistente, 400 para input inválido. Detalle
completo en `docs/database.md`.

De paso encontré y corregí un bug real: `nest build` calculaba mal el
`rootDir` de salida (por el import relativo de `prisma/seed.ts` a
`apps/web/datos.json`), y separadamente, `node dist/main.js` no arranca
porque `packages/{utils,types,shared,ui}` son TS fuente sin build propio y el
loader ESM nativo de Node no las resuelve en runtime (sí funciona con
Next.js y con `ts-node`). Cambié `dev`/`start` de `apps/api` para usar
`ts-node` en vez de `node dist/main.js` — funciona igual hoy, pero un build
real de esos packages (p. ej. con `tsup`) queda pendiente para antes de un
deploy de producción de verdad. No bloquea Fase 3.

## 13. Verificación — criterio de salida completo (Fase 2 + Fase 3)

```
pnpm install   ✅ (7 packages: web, api, types, utils, shared, config, ui)
pnpm build     ✅ (incluye next build + nest build)
pnpm lint      ✅ (0 errores; @areia-bela/api sin warnings, @areia-bela/web con
                   43 preexistentes/diferidos — ver sección 7)
pnpm typecheck ✅ (0 errores en ambas apps)
```

Rama `fase-2-monorepo`, nada pusheado. Historial local reescrito (sección 11),
`origin` sin tocar todavía.

## 14. Fase 4 — Autenticación

Punto de partida: `/admin` estaba **completamente abierto**. El login era un
mock con las credenciales prellenadas (`defaultValue="admin@areiabela.com"` /
`defaultValue="password"`), un `// For demo, always succeed` y un
`router.push('/admin')` tras un delay falso — nunca llamaba a ningún API. El
"logout" del sidebar y del header era un `<Link href="/">` al sitio público.
No existía nada de auth: ni dependencias, ni modelos, ni tipos.

### Alcance y decisiones

- **Rol como enum**, no tablas `Role`/`Permission`: `docs/domain-decisions.md`
  ya fija tres roles (`superadmin`, `manager`, `viewer`) y no hay requisito de
  asignar permisos uno por uno en runtime. Menos superficie que mantener.
- **2FA (TOTP) añadido a pedido del usuario**, no estaba en el alcance original
  de la Fase 4 del plan. Con app autenticadora, **no SMS** (vulnerable a SIM
  swapping y requeriría un proveedor de pago).
- **Tests**: primer setup de pruebas del repo. Es un adelanto acotado y
  declarado de Fase 8, limitado al núcleo de auth. Sin E2E ni integración.
- **Justificación de entidades nuevas** (lo exige `CLAUDE.md`): `User`,
  `RefreshToken` y `RecoveryCode` no están en la lista canónica del dominio.
  Son infraestructura de acceso al panel, no del dominio de reservas —
  `Customer` sigue siendo el huésped y nunca inicia sesión.

### Backend

- `apps/api/src/auth/`: Argon2id para contraseñas, access token JWT de 15 min,
  refresh token **opaco** (no JWT) de 7 días guardado **hasheado** y **rotado
  en cada uso**. Reusar un refresh ya revocado se trata como posible robo y
  revoca todas las sesiones de ese usuario.
- Lockout por cuenta (5 intentos → 15 min) además del rate limiting por IP.
  Los códigos 2FA fallidos cuentan para el mismo lockout, porque 6 dígitos son
  adivinables si no se limita.
- `JwtAuthGuard` **global**: un endpoint nuevo queda protegido salvo que use
  `@Public()`. Falla cerrado, no abierto. `RolesGuard` para `@Roles(...)`.
- `apps/api/src/users/`: CRUD solo para `SUPERADMIN`, baja lógica. Bloquea
  desactivarse o degradarse a uno mismo **y** quitar al último superadmin
  activo — sin eso era posible quedarse fuera del panel sin vuelta atrás
  desde la UI.
- TOTP: secreto cifrado en reposo con AES-256-GCM (`TOTP_ENCRYPTION_KEY`), no
  hasheado, porque verificar un código exige el secreto original. 10 códigos de
  recuperación de un solo uso, hasheados, mostrados una única vez.
- `main.ts`: `helmet`, `cookie-parser` y **CORS corregido** — era
  `enableCors()` sin opciones, que no permite credenciales, así que las cookies
  no habrían funcionado nunca. Ahora origen explícito + `credentials: true`.
  `ValidationPipe` con `forbidNonWhitelisted`.

### Frontend

- Protección en dos capas: el middleware comprueba que exista la cookie
  (barato, sin round trip) y el layout server-side de `/admin` verifica de
  verdad contra `GET /auth/me`. **El secreto JWT no vive en el frontend** —
  una cookie forjada pasa el middleware y muere en el layout.
- Login real de dos pasos (contraseña → código si hay 2FA), logout real,
  usuario y rol visibles, navegación filtrada por rol.
- Gestión de equipo y panel de 2FA (con QR generado en el servidor) en la
  pestaña "Team" de settings, que decía "coming soon".
- `lib/api-client.ts`: `credentials: 'include'` y **un** reintento silencioso
  contra `/auth/refresh` ante un 401, para que un access token expirando a
  mitad de sesión no eche al usuario.

### Auditoría del checklist de seguridad

`.claude/skills/domain-guard/security-checklist/SKILL.md`, ítem por ítem:

| Ítem                                        | Estado                               |
| ------------------------------------------- | ------------------------------------ |
| Contraseñas con Argon2                      | ✅ Argon2id                          |
| Access tokens de vida corta; refresh rotado | ✅ 15 min / rotación verificada      |
| Cookies `HttpOnly`, `Secure`, `SameSite`    | ✅ (`Secure` solo en producción)     |
| Rate limiting / lockout en login            | ✅ por IP y por cuenta               |
| `/admin/*` con middleware/guards reales     | ✅ middleware + layout + guards      |
| Sin login prellenado ni "always succeed"    | ✅ eliminado                         |
| Helmet, CORS y rate limiting en NestJS      | ✅                                   |
| Variables documentadas en `docs/env.md`     | ✅ creado                            |
| Rate limiting en reset de contraseña        | ⏸️ no aplica: no hay reset por email |

**Diferido a propósito** (no silenciado): recuperación de contraseña por email
y verificación de email (necesitan proveedor de correo, no están en Fase 4);
OAuth/SSO; tests E2E y de integración (Fase 8).

### Documentación

- `docs/env.md` **nuevo** (lo exigía el checklist y no existía): variables por
  nombre, cómo generar los secretos, y el caveat de cookies cross-site en
  producción — si web y API quedan en dominios distintos, `SameSite=Lax` deja
  de enviar la cookie. Documentado antes de descubrirlo en producción.
- `CLAUDE.md` **nuevo**: `docs/migration-plan.md` lo citaba como "reglas
  generales" pero el archivo no existía — puntero roto desde Fase 1.
- `AGENTS.md` actualizado: describía la app Next.js pre-monorepo, sin NestJS,
  Prisma ni `apps/*`. Ahora refleja el monorepo real y las convenciones de
  NestJS/Prisma.
- Fase 4 en `docs/migration-plan.md` **no tenía criterio de salida** (Fase 2 y
  3 sí). Se le añadió uno.

### Hallazgo durante la verificación

El rate limiting por IP (5/min en login) **es más estricto** que el lockout por
cuenta (5 intentos), así que desde una sola IP el 429 salta antes de que el
lockout llegue a contar. No es un bug: son capas distintas — el lockout protege
contra un atacante que rota IPs. Efecto práctico: el lockout no se puede
verificar por curl desde una sola máquina, y por eso se cubre en los tests
unitarios, que son deterministas.

## 15. Verificación — criterio de salida (Fase 4)

```
pnpm build     ✅ (next build + nest build)
pnpm lint      ✅ (0 errores)
pnpm typecheck ✅ (0 errores en ambas apps)
pnpm test      ✅ (53 tests, primer setup de pruebas del repo)
```

Verificado además contra Postgres y el API reales:

- Seed idempotente (dos corridas → 1 usuario) y falla ruidosamente sin
  `ADMIN_SEED_PASSWORD` o con una contraseña de menos de 12 caracteres.
- `/auth/me` y `/users` sin sesión → 401. `/users` como `VIEWER` → 403.
- Refresh rota el token; **reusar el anterior → 401**.
- 2FA completo: setup → enable con código real → login en dos pasos → sesión.
  Código de recuperación funciona una vez y a la segunda falla.
- El **challenge token de 2FA no sirve como access token** (agujero detectado y
  cerrado durante la implementación: ambos se firman con la misma clave).
- `/admin` sin sesión redirige a `/admin/login?from=...`; el login sigue
  accesible sin bucle de redirección.
- El sitio público **no cambió**: `/`, `/es`, `/en` y el rewrite de locale
  siguen funcionando; los endpoints de quote y fechas bloqueadas siguen
  públicos vía `@Public()`.

Rama `fase-4-auth`, nada pusheado.

## 16. Cuenta propia, gestión de equipo y restablecimiento por correo

Ajustes pedidos tras usar el panel de Fase 4.

### Separación de "mi cuenta" y "administrar a otros"

La pestaña Team mezclaba dos cosas de naturaleza distinta: tu 2FA personal y
el alta/baja de usuarios. Ahora son dos pestañas:

- **Security**: contraseña propia y 2FA. La ve cualquier rol.
- **Team**: solo el CRUD de usuarios, y la pestaña ni siquiera aparece si no
  eres `SUPERADMIN` — antes mostraba un aviso de permisos, que es peor UX que
  no ofrecer la puerta.

### Cambio de contraseña propia

`POST /auth/change-password`. Faltaba por completo: solo un superadmin podía
cambiarle la contraseña a otro, lo que obligaba a pedir por favor algo que
debería ser autoservicio y, de paso, hacía que esa persona conociera la
contraseña nueva.

- Exige la contraseña actual aunque ya haya sesión: una sesión olvidada
  abierta no debe bastar para tomar la cuenta.
- Rechaza reutilizar la misma contraseña.
- Revoca las demás sesiones, porque si la anterior se había filtrado, cambiarla
  tiene que echar al intruso. La sesión que hace el cambio recibe cookies
  nuevas para no autodesconectarse.

### Restablecimiento por correo (Brevo)

Dos entradas al mismo flujo: "¿Olvidaste tu contraseña?" en el login, y un
botón en Team para que el superadmin dispare el correo sin llegar a conocer la
contraseña nueva.

- Modelo `PasswordResetToken`: hasheado, de un solo uso, válido 1 hora. Pedir
  un enlace nuevo invalida el anterior.
- `POST /auth/forgot-password` **siempre responde 200**, exista o no la cuenta.
  Si respondiera distinto sería un enumerador de correos, justo lo que el login
  evita. Por el mismo motivo, un fallo del proveedor se registra en el log pero
  no cambia la respuesta.
- Al restablecer se revocan todas las sesiones y se limpia el lockout — un
  reset es también la vía de vuelta si te bloqueaste.
- **El reset no desactiva el 2FA**: recuperar la contraseña no puede saltarse
  el segundo factor. Quien resetee seguirá necesitando su autenticador o un
  código de recuperación.
- Las rutas `/admin/forgot-password` y `/admin/reset-password` se añadieron a
  la lista de rutas admin públicas del middleware; si no, quedarían tras el
  muro de sesión, inservibles para quien justamente no puede entrar.

**Proveedor: Brevo**, vía su API HTTP transaccional (no SMTP: así no hace falta
ninguna dependencia nueva, basta `fetch`). Sin `BREVO_API_KEY` no se envía
nada y el enlace se escribe en el log con un `WARN` — el flujo entero se puede
probar en local sin credenciales ni dominio verificado, y el aviso es ruidoso a
propósito para que no parezca que funciona cuando no.

Pendiente fuera del código, documentado en `docs/env.md`: crear la cuenta de
Brevo, generar la API key y **verificar el dominio** (SPF/DKIM). Sin ese último
paso los correos salen pero acaban en spam.

### Verificación

```
pnpm build     ✅
pnpm lint      ✅ (0 errores)
pnpm typecheck ✅
pnpm test      ✅ (67 tests, +14 sobre Fase 4)
```

Contra el API real: respuesta idéntica para cuenta existente e inexistente;
token de un solo uso (el segundo intento falla); la contraseña nueva funciona
y la vieja no; la sesión sobrevive al cambio propio; un `MANAGER` recibe 403 al
intentar disparar un reset ajeno. En el navegador: las páginas de recuperación
son accesibles sin sesión y el resto de `/admin` sigue redirigiendo.

## 17. Panel de administración — traducción, invitaciones y pase visual

Pedido tras usar el panel de Fase 4. Alcance acordado: solo `/admin`.

### Bugs encontrados de paso

- **Los tres gráficos no tenían color.** Usaban `hsl(var(--primary))`, pero al
  retokenizar la marca (sección 15) `--primary` pasó a ser un hex, y
  `hsl(#174d7a)` es CSS inválido. Lo introduje yo en esa pasada.
- **Seis de las nueve pantallas no tenían navegación en móvil.** El botón del
  menú vive dentro de `AdminHeader`, y solo tres páginas lo renderizaban. Era
  un fallo funcional, no estético.
- **La barra lateral seguía con la paleta de shadcn.** En la retokenización
  excluí los tokens `--sidebar-*` porque el alcance era el sitio público, así
  que el elemento más visible del panel usaba un coral ajeno a la marca.
- **Una constante importada desde un módulo `'use client'` llegaba `undefined`
  al servidor.** El layout leía `LANGUAGE_COOKIE` desde el provider del sitio
  público; en un server component eso resuelve a `undefined`, y el idioma se
  quedaba fijo en español pese a la cookie. Movida a `@areia-bela/shared`.

### Traducción

- `AdminLanguageProvider` propio, separado del público: aquel deriva el idioma
  del segmento `[locale]` y navega al cambiarlo, pero `/admin` está excluido
  de esa reescritura, así que reutilizarlo habría empujado a `/es/admin` y 404.
  El admin usa estado más la **misma cookie**, así que cambiar el idioma en el
  panel también cambia el sitio de huéspedes.
- El idioma se lee en el servidor, de modo que el primer render ya sale bien.
- Diccionario en `lib/admin-i18n.ts`, y la navegación pasó a indexarse por
  clave en `admin-navigation.ts` para no traducir la misma etiqueta dos veces.

### Invitaciones en lugar de contraseñas por correo

Se pidió generar la contraseña y enviarla por correo. Se implementó **enlace de
invitación**: el correo no es un canal seguro — la contraseña quedaría en el
buzón para siempre y quien lo abriera entraría a la cuenta.

- `POST /users` ya no acepta `password`; el campo desapareció también de
  `UpdateUserDto`, porque un admin no debe fijar la contraseña de nadie.
- Al crear la cuenta se guarda un hash aleatorio inservible: existe pero no se
  puede entrar hasta seguir el enlace. Mantener `passwordHash` no nulo evita
  añadir guardas de null en cuatro llamadas a `argon2.verify`.
- `invitedAt` / `passwordSetAt` distinguen "invitado, nunca entró" de activo, y
  la tabla de equipo lo muestra como "invitación pendiente" con opción de
  reenviar.
- Reutiliza el token de restablecimiento (mismo modelo, mismo endpoint), con
  vida más larga (72 h frente a 1 h): una invitación llega sin avisar y puede
  esperar en la bandeja. La página de reset cambia el texto con `?invite=1` en
  vez de duplicarse.

### Interfaz

- El alta de miembros pasó de un formulario siempre visible al pie de la tabla
  a un **botón que abre un modal**, sin campo de contraseña.
- **Sonner montado** por fin: había dos sistemas de avisos en `packages/ui` y
  ninguno conectado, así que cada mensaje era un div a mano. Ahora son toasts.
- El encabezado se renderiza **una vez en el layout** y deriva su título de la
  ruta: ninguna pantalla puede volver a olvidarlo. Se quitaron de paso las tres
  notificaciones falsas ("Emily Johnson booked Luxury Suite") que llevaba.
- **Settings perdió cuatro pestañas** (General, Booking, Notifications,
  Billing): 26 campos que no guardaban nada tras un botón "Save changes" que
  era un `setTimeout` de un segundo. No hay endpoint al que conectarlos —
  llegan con el CMS en Fase 5. Un control que aparenta guardar es peor que
  ningún control.
- `guests` y `reservations` dejaron de decir "under construction" y usan el
  componente `Empty`, que existía sin usar, explicando qué los llenará.
- Las cinco pantallas con cifras inventadas llevan un aviso visible y fijo de
  datos de ejemplo, para que nadie decida sobre ellas.

### Diseño

- La barra lateral pasa a **navy profundo con el elemento activo en crema**: es
  la apuesta visual de esta pasada. Separa navegación de contenido mucho mejor
  que el casi-blanco de shadcn y pone el color de marca a liderar.
- El panel abre con **la casa en las próximas tres semanas**, no con cuatro
  tarjetas genéricas: hay una sola unidad, así que el tiempo es el único eje
  que importa. Y usa **datos reales** — las fechas bloqueadas del API son la
  única información viva que el panel tiene hoy.
- Paleta de gráficos **validada con el checker de la skill de dataviz** (banda
  de luminosidad, croma, separación para daltonismo y contraste) en claro y
  oscuro. El navy de marca falló la prueba por oscuro y grisáceo, así que la
  primera serie es un pariente más claro y saturado. Los cinco hex sueltos de
  informes pasaron a tokens.

### Verificación

```
pnpm build     ✅
pnpm lint      ✅ (0 errores; 0 warnings en los archivos tocados)
pnpm typecheck ✅
pnpm test      ✅ (73 tests, +6 de invitaciones)
```

Contra el API real: crear un miembro sin contraseña devuelve 201 y deja
`passwordSetAt` en null; enviar `password` en el cuerpo da 400; el invitado no
puede entrar hasta usar el enlace; tras fijarla, entra y deja de figurar como
pendiente. En el navegador: las nueve pantallas responden 200 y **todas** tienen
el menú móvil, el panel cambia de idioma con la cookie en ambos sentidos, y el
sitio público sigue intacto.

Pendiente en su momento, **resuelto en la sección 18**: calendario, precios y
mantenimiento seguían modelados como hotel.

## 18. Las tres pantallas de hotel, rehechas como casa única

Cierra el pendiente declarado en la sección 17. `CLAUDE.md` prohíbe
reintroducir `Room`, y estas tres pantallas eran exactamente eso: una matriz de
habitaciones × fechas, tarifas por tipo de cuarto y tareas por número de
habitación. Restilizarlas habría conservado el modelo equivocado.

- **Calendario**: una sola línea de tiempo. Hay una unidad reservable, así que
  no existe una segunda fila que poner — un mes en rejilla donde cada noche
  está libre o no. Se fueron el filtro por piso y el selector de vista.
  Las fechas bloqueadas salen del **API real**, lo que convierte esta en la
  única pantalla del panel completamente viva.
- **Precios**: por noche para la casa entera. Tarifa base ($300), limpieza
  ($120) y los cuatro extras son las **cifras reales** del listing y de
  `docs/domain-decisions.md`, así que esta pantalla **perdió el aviso de datos
  de ejemplo**: mantenerlo habría sido mentir al revés. Las temporadas dicen
  abiertamente que aún no existen en vez de inventar tarifas, porque no hay
  cifras reales para ellas.
- **Mantenimiento**: agrupado por zona de la casa — piscina, cocina, baños,
  exterior — en vez de por número de cuarto y piso. Son tres dormitorios y dos
  baños, no un plano de unidades numeradas. Las tareas siguen siendo de
  ejemplo, y lo dice.

Limpieza asociada:

- `recent-reservations.tsx` y `upcoming-activity.tsx` quedaron huérfanos al
  rediseñar el panel y ambos imprimían "Room N": eliminados.
- La pestaña "Room Type Performance" de informes, que es literalmente el
  reporte de ocupación por tipo de cuarto que el dominio prohíbe: eliminada.
- `mockRooms`, `mockStaff`, `mockReservations`, `mockPricingRules`,
  `mockMaintenanceTasks` y `roomStats` quedan sin un solo consumidor. Se dejan
  en `lib/mock-data.ts` por ahora: borrarlos es una limpieza aparte y este
  cambio ya es grande.

Un `useMemo` del calendario impedía que el React Compiler optimizara el
componente (error de lint, no advertencia). Eliminado: son 42 fechas y el
compilador lo hace mejor solo.

### Verificación

```
pnpm build     ✅
pnpm lint      ✅ (0 errores)
pnpm typecheck ✅
pnpm test      ✅ (73 tests)
```

Las tres pantallas responden 200 y **cero coincidencias** de "Room", "piso" o
"habitación" en todo `/admin`. Precios muestra las cifras reales; mantenimiento
lista las zonas; el calendario abre en el mes actual con sus controles.
