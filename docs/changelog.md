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

## 19. Fase 5 — CMS: el sitio se edita desde el panel

Antes de esta fase, cambiar una frase del sitio de huéspedes era editar un
`.ts` y desplegar. Ahora el contenido vive en la base de datos y se edita desde
`/admin`.

### Backend (commit `c234298`)

Cuatro modelos nuevos, justificados aquí porque `domain-guard` exige declarar
toda entidad fuera de la lista canónica:

- `CMSPage` — los doce slugs que `packages/types` ya fijaba. Contenido
  bilingüe en dos columnas por campo (`titleEs`/`titleEn`, `bodyEs`/`bodyEn`)
  en vez de un JSON: mantiene las columnas tipadas y consultables, y el
  producto solo va a ser ES/EN.
- `FAQ` — pregunta, respuesta, tema y orden.
- `GalleryImage` — URL, texto alternativo bilingüe y orden.
- `SiteSettings` — fila única con `id` fijo `"site"`, igual que `Property`.

Ninguno es una entidad de negocio: son contenido editorial del sitio. No
introducen inventario, ni habitaciones, ni multi-propiedad.

Reglas de acceso:

- **Lectura pública, escritura autenticada.** El sitio de huéspedes lee este
  contenido sin sesión; editarlo exige superadmin o manager.
- Las lecturas de editor (`/cms/admin/*`, que incluyen borradores) las puede
  hacer **cualquier rol con sesión, viewer incluido**: ver el panel es
  justamente para lo que existe ese rol, y un texto sin publicar no es un
  secreto frente al equipo. Solo se estrechan las escrituras.
- Reordenar galería y FAQs recibe la lista completa y la escribe en una
  transacción: un fallo a medias no deja la numeración rota.
- Los extras **se desactivan, no se borran**: las reservas pasadas los
  referencian por `BookingExtra` y eliminarlos reescribiría el historial.
- `PATCH /properties/:slug` es el endpoint que faltaba para devolver las
  pestañas de ajustes que se quitaron en la fase anterior por no tener dónde
  guardar.

Galería: subida a Vercel Blob, con escritura en disco local cuando no hay
`BLOB_READ_WRITE_TOKEN` (para poder trabajar sin cuenta) y aviso por log,
porque en un host efímero esos archivos desaparecen en cada despliegue. Valida
tipo y tamaño, y renombra con un prefijo aleatorio. Al borrar, primero la fila
y luego el archivo: un blob huérfano es más barato que una fila rota.
`apps/web/public/uploads/` quedó en `.gitignore`.

**Hueco declarado, no tapado**: el listing scrapeado solo existe en inglés, así
que el seed pone ese mismo texto en las columnas en español y el editor lo
marca como pendiente de traducir. Inventar copy de marketing en español sería
peor que enseñarle al anfitrión exactamente qué le falta.

### Panel

- **Sitio web** (`/admin/content`), sección nueva del menú:
  - **Textos**: los doce slugs en una lista con marca de traducido/pendiente,
    y el editor en dos columnas — español a la izquierda, inglés a la derecha.
    Se editan en paralelo porque traducir es leer una columna mientras se
    escribe la otra. No deja guardar con un idioma vacío: publicar media
    traducción es justo el fallo que esta pantalla existe para evitar.
  - **Preguntas**: alta, edición, borrado y reorden.
  - **Fotos**: subida múltiple, texto alternativo en los dos idiomas,
    publicar/ocultar, borrar con confirmación y reorden por arrastre **o** por
    flechas (arrastrar solo no es accesible con teclado). La primera foto es la
    portada, y lo dice.
- **Ajustes** recupera dos pestañas, ahora sí conectadas: **La casa**
  (capacidad, cargos, horarios, días de basura, dirección) y **Contacto y SEO**
  (correo, teléfono, WhatsApp, títulos y descripciones para buscadores,
  enlaces a redes). Cada campo llega a la base de datos; era exactamente lo que
  faltaba cuando se borraron los 26 campos que no guardaban nada.
- **Precios** deja de leer cifras del `datos.json` y lee la propiedad real,
  incluida la tarifa base desde `PriceRule`. Los extras se editan en un modal
  (precio, unidad de cobro, temporada, reembolsable, a pedido) y se pueden
  dejar de ofrecer.

### Sitio de huéspedes

De poco sirve un editor cuyo texto no ve nadie, así que el sitio ya consume el
CMS:

- `generateMetadata` toma título y descripción de `SiteSettings`, por idioma.
- La galería usa las fotos de `GalleryImage` cuando las hay.
- Sección nueva "Todo sobre la casa" con las páginas publicadas y las preguntas
  frecuentes, renderizada **en el servidor**: un texto que aparece después de
  la hidratación es invisible para los buscadores.
- Teléfono, correo y redes del pie salen de `SiteSettings`.

Todo con respaldo: si el API no responde, el sitio cae a la copia de
`lib/property-data.ts` en vez de romperse. Una página de reservas que devuelve
500 porque parpadeó un servicio de textos es peor que una con palabras algo
viejas.

### Dashboard e informes, sin cifras inventadas

El panel abría con cuatro tarjetas y tres gráficas de series inventadas. No hay
`Booking` en la base todavía, así que no había nada que medir.

- El dashboard ahora muestra cuatro cifras **reales** (noches libres en 30
  días, tarifa base, fotos publicadas, secciones por traducir), cada una
  enlazada a la pantalla donde se cambia, y un estado vacío honesto donde
  estaban las gráficas.
- **Informes** eran 339 líneas de ficción: $752.000 de ingresos, comisiones de
  Expedia y rendimiento por "Presidential Suite" en el panel de una casa de
  tres dormitorios que no está en ninguno de esos canales. Además de falso, el
  desglose por cuarto y la mezcla de canales son el modelo de hotel que
  `CLAUDE.md` prohíbe. Sustituido por un estado vacío que dice cuándo llegan
  las cifras (Fase 6, con reservas reales).

Limpieza asociada: se fueron `revenue-chart`, `occupancy-chart` y
`channel-chart` (sin consumidor y con la forma de los datos falsos),
`services/reservations.ts` (una API simulada con `roomId`/`roomType`/`channel`)
y los últimos exports huérfanos de `lib/mock-data.ts` — `rooms`, `channels`,
`seasonalPricing`, `dailyStats`, `channelStats`, `generateAvailability`,
`reservations`, `guests`, `coupons` y `reviews`. El archivo pasa de 637 a 155
líneas y ya solo conserva lo que alguien lee.

Además: `hsl(var(--primary))` quedaba de la paleta anterior en informes y en
`packages/ui/src/sidebar.tsx`. Con los tokens en hexadecimal esa función es
inválida, así que esas gráficas y ese borde se dibujaban sin color. Corregido a
`var(--primary)`.

### Diferido

- **La copia de marketing de la portada** (hero, tarjetas de comodidades,
  reseñas, sección de la anfitriona) sigue en `lib/i18n.ts`. Llevarla al CMS es
  rediseñar esa página, no conectar un campo; el contenido largo, las preguntas
  y el SEO —que es lo que el anfitrión cambia— ya se editan.
- **Optimización de imágenes**: `next.config.mjs` tiene `images.unoptimized`,
  así que las fotos se sirven tal cual se suben. Queda para Fase 8, con el
  resto del trabajo de rendimiento.
- **Tarifas por temporada**: se muestran si existen, pero crearlas y aplicarlas
  a una cotización es Fase 6.

### Verificación

```
pnpm build     ✅
pnpm lint      ✅ (0 errores)
pnpm typecheck ✅
pnpm test      ✅ (85 tests, 12 nuevos de CmsService)
```

Contra el API levantado, con un superadmin temporal creado y borrado para la
prueba:

- Escrituras de páginas, FAQs, ajustes, propiedad y extras → 200; las mismas
  como `VIEWER` → **403**; sin sesión → **401**.
- Lecturas de editor como `VIEWER` → 200 (es lo que se corrigió al detectar
  que el dashboard le quedaba en blanco a ese rol).
- Subida de imagen real → 200 y archivo en disco; borrado → 204 y archivo
  eliminado; subir un `.txt` → **400** con el motivo.
- Reorden de FAQs → 200; borrado → 204.
- `GET /es` y `GET /en` devuelven el título del CMS en `<title>` y traen las
  preguntas y las secciones **en el HTML**, no tras hidratar.

## 20. La portada entera, editable desde el panel

Fase 5 dejó editables el SEO, la galería, las secciones largas, las preguntas y
el contacto. Faltaba lo más visible: la portada, con su texto incrustado en
unas 500 líneas de objetos bilingües dentro del componente más `lib/i18n.ts`.
Cambiar una frase del hero era editar un `.ts` y desplegar. Ya no.

### Modelo de datos

Tres modelos nuevos, justificados aquí porque `domain-guard` exige declarar
toda entidad fuera de la lista canónica. Ninguno es de negocio: son contenido
editorial, sin relación con `Booking` ni `Customer`.

- **`ContentSection`** — una fila por sección de la portada (ocho claves fijas),
  con las ranuras de texto que puede usar: antetítulo, título, subtítulo,
  cuerpo, botón, una cifra destacada, una imagen y un enlace. Las que no usa
  quedan en cadena vacía; columnas nulables dirían lo mismo con más
  comprobaciones.
- **`ContentItem`** — los cinco listados de la página (insignias del hero,
  tarjetas, etiquetas de servicios, puntos cercanos y cifras de la anfitriona)
  son todos "icono + imagen opcional + una etiqueta y un texto bilingües, en un
  orden". Un solo modelo los cubre, y por eso también comparten **un solo
  editor** en vez de cinco casi idénticos que habría que mantener sincronizados.
- **`Review`** — aparte porque su forma sí es distinta: nota, autor y foto.

`SiteSettings` gana `logoUrl`, que usan cabecera y pie.

### Reglas que impone el servidor

- **O los dos idiomas, o ninguno.** El DTO no puede comprobarlo (solo ve campos
  opcionales), así que el servicio compara lo que llega contra lo guardado y
  devuelve 400 si un campo queda cojo. Es la misma regla de las páginas, ahora
  aplicable a un formulario donde la mayoría de las ranuras van vacías.
- **Una sola reseña destacada.** Promover una demota a la anterior en el
  servidor; no es algo que el navegador deba recordar hacer.
- El orden de los ítems es **por lista, no por sección**: añadir una insignia no
  la manda al final por culpa de las tarjetas que viven en la misma sección.

### Traducción asistida

Botón "traducir" en cada campo bilingüe. Llama a la API de Claude y **deja la
propuesta en el input**; el anfitrión la lee y decide si guarda.

Deliberadamente no es automático. `CLAUDE.md` prohíbe inventar traducciones, y
una traducción automática que llega al huésped sin que nadie la lea es
exactamente eso. Con el botón, la máquina propone y una persona responde por el
texto. Sin `ANTHROPIC_API_KEY` el botón no aparece —un control que solo da error
es peor que ninguno— y escribir los dos idiomas a mano sigue funcionando igual.

Se usa Sonnet, no Opus: son cadenas cortas de marketing y el modelo barato y
rápido sobra. Al modelo se le dice explícitamente que esto es una casa y no un
hotel, para que no traduzca "habitaciones" ni "recepción".

### Panel

Pestaña **Portada** nueva en `/admin/content`, con las ocho secciones en una
lista lateral y, para cada una, solo las ranuras que esa sección usa: el
formulario se genera de una tabla de composición en vez de haber ocho
formularios distintos.

- **Selector de iconos** visual con 41 iconos elegidos para una casa de playa.
  El anfitrión no escribe `PawPrint` a mano, y el conjunto acotado evita que la
  portada derive en una sopa de iconos.
- **Subida de imágenes** por campo (tarjetas, retrato de la anfitriona, foto de
  cada huésped, logo), reutilizando el almacenamiento de la galería. Van por una
  ruta aparte a propósito: pertenecen a un campo, no a la cuadrícula pública de
  fotos, así que no deben aparecer en ella.
- **Pestaña Reseñas**: alta, edición, foto, estrellas, fecha, verificada,
  destacada, ocultar y reordenar.
- **Ocultar secciones enteras**, que era el pedido concreto sobre las reseñas.
- El **logo** se cambia en Ajustes → Contacto y SEO.

### Sitio de huéspedes

Hero, tarjetas, servicios, reseñas, ubicación (incluido el enlace del mapa),
reserva directa, anfitriona, pie y logo salen del CMS, renderizados en el
servidor. Todo con respaldo a la copia local si el API no responde.

El título del hero se escribe como una frase y el componente le aplica la
tipografía de marca a las últimas palabras, como hacía la versión de tres líneas
incrustada. El anfitrión escribe texto; no tiene que pensar en saltos de línea.

### Seed

`pnpm --filter @areia-bela/api seed:landing` mueve a la base el texto que ya
estaba vivo, más las cuatro reseñas reales del listing. Idempotente: las
secciones hacen upsert y los ítems y reseñas se buscan por su clave natural
antes de insertar, así que correrlo dos veces no duplica ni pisa una edición.

**Huecos declarados**: los nombres de los servicios existen solo en español en
el listing, y las reseñas solo en inglés. Esas filas se siembran con el texto de
origen en ambos lados. No se rellenan con traducción automática porque nadie la
habría leído; para eso está el botón, que deja a una persona en medio.

### Diferido

- **El cotizador sigue calculando en el navegador.** `lib/booking.ts:32` usa el
  `datos.json` estático y nadie llama a `POST /properties/:slug/quote`, que ya
  existe. Rompe la regla de precio autoritativo en el servidor y hace que lo que
  se edita en Ajustes no le llegue al huésped. Es Fase 6 y merece su propio
  cambio; se deja anotado, no tapado.
- Optimización de imágenes (`images.unoptimized` sigue puesto): Fase 8.
- El editor de textos sigue sin vista previa ni autoguardado.

### Verificación

```
pnpm build     ✅
pnpm lint      ✅ (0 errores)
pnpm typecheck ✅
pnpm test      ✅ (95 tests, 10 nuevos)
```

Contra el API levantado, con un superadmin temporal creado y borrado para la
prueba:

- Escrituras de secciones, ítems y reseñas → 200/204; como `VIEWER` → **403**;
  sin sesión → **401**. Las lecturas de editor como `VIEWER` → 200.
- `PATCH` de una sección con un solo idioma → **400** con el campo que falta.
- Promover una segunda reseña destacada deja **exactamente una** destacada.
- Sin `ANTHROPIC_API_KEY`: `translation-status` responde `configured: false` y
  `POST /cms/translate` → **503** con el motivo.
- Correr el seed dos veces: `0 elementos nuevos, 0 reseñas nuevas`.
- `GET /es` y `GET /en` traen las insignias, las tarjetas, el desglose de notas,
  las cifras de la anfitriona y el texto del pie **en el HTML**.

Una nota de método: la primera verificación dio media pantalla en blanco y el
motivo no era el código sino un `next-server` viejo sirviendo el bundle
anterior. Reiniciarlo lo arregló. Es la segunda vez que pasa en este repo.

## 21. El precio deja de calcularse en el navegador

Al probar la portada editable salió el fallo de fondo: podías cambiar la tarifa
de limpieza en Ajustes y al huésped se le seguía cobrando la vieja. Tirando de
ahí apareció algo peor.

### El agujero

`apps/web/app/api/checkout/route.ts` le pasaba a Stripe el `totalPrice` que
llegaba en el cuerpo de la petición, tal cual. Y ese total viajaba desde el
cotizador hasta el checkout **en la query string**. Editar la URL a
`?total=1` era una forma que funcionaba de pagar un dólar por una semana.

`lib/booking.ts` calculaba el precio en el navegador con las cifras del
`datos.json` incluido en el bundle. De ahí los dos síntomas: el precio no
cambiaba al editarlo, y era el que dijera el navegador.

`CLAUDE.md` lo prohíbe explícitamente: _"El precio es siempre autoritativo en el
servidor. El frontend nunca envía un total que el backend acepte sin
recalcular."_ El endpoint `POST /properties/:slug/quote` existía desde Fase 3 y
no lo llamaba nadie.

### El arreglo

- `buildQuote()` se va; en su lugar `fetchQuote()` le pregunta al API.
- **A la URL solo viajan las entradas** —fechas, huéspedes, extras—, nunca un
  importe. Manipularlas ya no significa nada: te cotizan bien esas fechas.
- El checkout **vuelve a pedir el precio** al cargar, en vez de creerle a la
  query string.
- La ruta de Stripe **cotiza contra el API** y cobra esa cifra. Si el API no
  responde devuelve 502: negarse a cobrar es mejor que adivinar un precio.
- El cotizador ya no dibuja un precio de relleno mientras carga. Un precio
  provisional es un precio equivocado; dice que está consultando.

De paso, tres cosas que aparecieron al tocarlo:

- `origin` vacío generaba URLs de retorno relativas y Stripe las rechazaba.
  Ahora cae al origen de la propia petición.
- La ruta devolvía el mensaje de error de Stripe al navegador; puede nombrar
  configuración interna y el huésped no puede hacer nada con él.
- `services/payment.ts` tenía cuatro funciones simuladas sin ningún consumidor,
  una de ellas decidía si un pago salía bien con `Math.random() > 0.05`.
  Eliminadas: el cobro de verdad es Fase 7, y dinero simulado es peor que nada.
- `roomId` / `roomName` / `roomType: 'casa'` en los metadatos de Stripe, restos
  del modelo de hotel. Sustituidos por los datos de la estadía que la Fase 7
  necesita para crear el `Booking` desde el webhook.

### `verify-quote-parity.ts`, eliminado

Ese script comparaba la `buildQuote()` del cliente con la `computeQuote()` del
servidor para probar que no divergían. Ya no hay dos implementaciones: el
cliente pregunta. La paridad pasó de comprobarse a ser estructural, y mantener
un script que corre una función que ya no existe habría sido deuda. Anotado
también en `docs/database.md`, que lo citaba como criterio de salida de Fase 3.

### Verificación

```
pnpm build     ✅
pnpm lint      ✅ (0 errores)
pnpm typecheck ✅
pnpm test      ✅ (95 tests)
```

Contra el API y Stripe de prueba reales:

- El API cotiza 7 noches en **$2745**.
- Se manda al checkout esa estadía **con `total: 1` y `totalPrice: 1`** en el
  cuerpo. La sesión de Stripe creada cobra `amount_total: 274500` centavos, es
  decir **$2745**. El importe del navegador se ignora por completo.
- Fechas inválidas → **400**.
- Cambiar la tarifa de limpieza a $200 en Ajustes: la cotización pasa de $2745 a
  **$2825** en la petición siguiente, sin desplegar. Restaurada a $120.

## 22. Cinco idiomas, escritos una sola vez

El panel pedía cada texto dos veces, en español y en inglés. Eso funcionaba con
dos idiomas y no sobrevive a cinco: el anfitrión habría escrito cada frase cinco
veces, y `ContentSection` sola habría llegado a cuarenta columnas.

Ahora **se escribe una vez, en español**, y el sitio muestra el idioma que pida
el visitante: español, inglés, portugués, francés o alemán.

### El modelo

Las columnas `…Es`/`…En` se colapsan a una sola —la del idioma en que se
escribe— y aparece `Translation`: una fila por (registro, campo, idioma).

El texto fuente **no** está en esa tabla; sigue en su propio modelo. Así una
fila ausente significa exactamente "todavía sin traducir", y el sitio cae a la
fuente. Un huésped leyendo español en una página en francés es mejor que uno
leyendo una página en blanco.

`entity`/`entityId` son una referencia suelta a propósito: una clave foránea de
verdad habría exigido una tabla puente por modelo, y esta tabla no tiene
significado propio que proteger.

Dos reglas evitan que esto falle en silencio:

- **`sourceHash`.** Cada traducción guarda el hash del texto del que salió. Si
  el anfitrión edita el español, la traducción queda caducada y el sitio vuelve
  a la fuente. Sin eso, editar una frase dejaba cuatro traducciones viejas que
  se veían perfectamente bien y decían otra cosa.
- **`isMachine`.** Una traducción que una persona corrigió no se vuelve a
  sobrescribir.

La migración **conserva lo ya escrito**: se escribió a mano en SQL en vez de
dejar que Prisma tirara las columnas, así que las 65 traducciones al inglés que
ya existían pasaron a `Translation` marcadas como humanas.

### El panel

Un campo por texto, con un globo que avisa de que se traducirá solo. El botón
"traducir" manual desaparece: existía para rellenar la segunda columna, y ya no
hay segunda columna.

Cuando `ANTHROPIC_API_KEY` no está configurada, `/admin/content` lo dice con un
aviso. Sin él, el anfitrión escribiría en español, vería el sitio en español
para los otros cuatro idiomas, y no tendría forma de saber que la causa es una
clave que falta y no un error.

El panel en sí **se queda en español e inglés**: es la herramienta del equipo,
no el sitio de huéspedes. `AdminLanguage` es ahora un tipo aparte de `Language`.

### El sitio

`GET /cms/site?locale=xx` devuelve la página entera ya en un idioma: seis
consultas y una resolución, en vez de que cada componente resuelva lo suyo. El
modelo no se llama en tiempo de petición — el texto ya está guardado.

Los textos fijos de la interfaz (navegación, botones, el cotizador) siguen en
`lib/i18n.ts` porque son parte del producto, no contenido del anfitrión. El
portugués, el francés y el alemán de ahí son **traducciones automáticas que
nadie ha revisado**, y el comentario del archivo lo dice: para una docena de
etiquetas estándar de un sitio de reservas es un intercambio aceptable, y
corregir una es cambiar una línea. Las palabras del anfitrión nunca funcionan
así: esas se traducen al guardar y quedan marcadas.

El selector de idioma pasa de cinco píldoras a un desplegable con el nombre de
cada idioma. A dos idiomas una fila de botones era ordenada; a cinco satura la
cabecera, y el nombre completo es lo que un visitante busca.

El asistente de chat solo tiene respuestas escritas en español e inglés, y sus
palabras clave no coincidirían con texto en francés de todos modos, así que en
los otros tres idiomas responde con la frase de traspaso —traducida— que dice
que contestará una persona. Es el resultado honesto.

### Verificación

```
pnpm build     ✅
pnpm lint      ✅ (0 errores)
pnpm typecheck ✅
pnpm test      ✅ (103 tests, 8 nuevos de TranslationService)
```

- Migración aplicada sobre datos reales: **65 traducciones conservadas**, cero
  perdidas. El inglés del hero sigue ahí y marcado como humano.
- `GET /cms/site` en los cinco idiomas: `es` da la fuente, `en` da la traducción
  migrada, y `pt`/`fr`/`de` caen a la fuente porque aún no hay clave.
- Las cinco rutas del sitio responden 200 y la interfaz sale en su idioma.
- Insertada a mano una traducción al francés: el sitio la sirve. Editado después
  el español: el sitio **deja de servirla** y muestra el texto nuevo, que es la
  garantía que da el `sourceHash`. Ambas pruebas revertidas.
- Los tres seeds corridos dos veces: sin duplicados.

### Diferido

- **No se ha traducido nada de verdad todavía**: hace falta `ANTHROPIC_API_KEY`
  en `apps/api/.env`. En cuanto esté, guardar cualquier texto lo traduce a los
  cuatro idiomas restantes. La maquinaria está probada; lo que falta es la clave.
- La traducción corre al guardar, en segundo plano. Con muchos campos eso son
  varias llamadas seguidas; si llega a molestar, la siguiente parada es una cola.
- El panel no muestra todavía qué está traducido y qué no, ni permite corregir
  una traducción concreta. `isMachine` ya existe en la base para soportarlo.

## 23. El traductor pasa a ser intercambiable, y gratis por defecto

Casar el sitio con un proveedor de pago fue una decisión mía sin preguntar.
Ahora hay tres y se eligen por variable de entorno.

|                         | Coste                          | Cuándo                                                                                              |
| ----------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| **DeepL** (por defecto) | Gratis, 500.000 caracteres/mes | Lo normal. Es además la mejor calidad para estos cinco idiomas                                      |
| **LibreTranslate**      | Gratis, autoalojado            | Cuando los textos no deban salir del propio servidor                                                |
| **Claude**              | De pago, centavos              | Cuando importe el contexto: es el único al que se le puede decir que esto es una casa y no un hotel |

Para dimensionarlo: el sitio entero son **103 textos, 9.788 caracteres**.
Traducirlo todo a los cuatro idiomas gasta el **8% del cupo mensual gratuito**
de DeepL, y después solo se retraduce lo que se edita.

`selectProvider()` toma el primero que esté configurado, DeepL primero, y
`TRANSLATION_PROVIDER` fuerza uno. Si se fuerza uno que no está configurado
devuelve nada en vez de usar otro en silencio: si alguien pidió un servicio
concreto, mandar sus textos a otro sin avisar no es una cortesía.

### Detalles que cuestan una tarde si no se saben

- Las claves gratuitas de DeepL terminan en `:fx` y **dan 404 contra el host de
  pago**. El código detecta el sufijo y enruta solo.
- DeepL rechaza `EN` a secas como destino. Se pide `EN-US`, y `PT-BR` para
  portugués: los brasileños son la mayoría de los visitantes lusófonos a
  Florida. Ambas decisiones están en una constante, no repartidas.
- `preserve_formatting` activado, porque varios campos dependen de los saltos
  de línea.
- El 456 de DeepL ("cupo agotado") se traduce a un mensaje que lo dice, porque
  la solución es esperar al mes siguiente, no depurar.
- LibreTranslate: se normaliza la barra final de la URL y se omite `api_key`
  del cuerpo cuando no hay, en vez de mandarlo vacío.

### El panel dice quién traduce

El aviso de `/admin/content` ya no solo dice si está encendido: nombra el
proveedor. A qué empresa le llegan los textos del anfitrión no debería tener
que deducirse leyendo la configuración del despliegue.

El API también lo anuncia al arrancar (`Translating with DeepL`).

### Verificación

```
pnpm build     ✅
pnpm lint      ✅ (0 errores)
pnpm typecheck ✅
pnpm test      ✅ (116 tests, 13 nuevos de proveedores)
```

- Arrancado sin claves: `Translation is off`. Con `DEEPL_API_KEY`:
  `Translating with DeepL`.
- **Con una clave de DeepL inválida, guardar una sección devuelve 200** y el log
  dice `Could not translate … DeepL: Forbidden` con el enlace a su
  documentación. Que el traductor esté caído no puede impedir que el anfitrión
  guarde sus propias palabras.
- Los tests cubren el enrutado de host por sufijo de clave, `EN-US`/`PT-BR`, el
  456 de cupo y la barra final de LibreTranslate — que es justo lo que se rompe
  en silencio.

## 24. DeepL mudaba la casa a Rusia

Con la clave puesta y las 416 traducciones generadas, la primera revisión del
resultado encontró esto:

```
fr: Saint-Pétersbourg, Floride, États-Unis
pt: Casa inteira com piscina aquecida em São Petersburgo
```

DeepL tradujo el topónimo. "Saint-Pétersbourg" y "São Petersburgo" son la
ciudad rusa: un huésped francés leía que la casa está en Rusia, junto a la
palabra "Floride". Es exactamente la clase de detalle que hace desconfiar de un
sitio de reservas.

### Tres intentos, dos descartados

**`ignore_tags`.** Envolver el nombre en una etiqueta que DeepL ignora. Los
nombres sobrevivieron, pero se rompió la gramática alrededor, porque el modelo
dejó de ver la palabra con la que tenía que concordar:

```
fr: près d'Madeira Beach     pt: perto dMadeira Beach     fr: à l'St. Petersburg
```

Cambié un error por uno peor: éste se ve roto a simple vista. Descartado.

**Glosario.** Es la respuesta propia de DeepL a este problema, y los cuatro
pares la soportan. Pero al crearlos:

```
fr: creado     de: Too many glossaries     pt: Too many glossaries
```

**El plan gratuito permite exactamente un glosario por cuenta**, así que no
puede cubrir cuatro idiomas de destino. Descartado, y anotado aquí para que
nadie lo intente otra vez.

**Aprender y revertir.** Lo que quedó, y que no depende de nada: se traduce
cada nombre por separado una vez, se aprende en qué lo convierte DeepL, y se
sustituye de vuelta en el resultado. DeepL sigue viendo la frase entera, así
que la gramática sale bien; solo se restaura el sustantivo. En la práctica solo
el francés lo traducía.

Se aprende una vez por idioma y se cachea: seis términos por cuatro idiomas,
veinticuatro llamadas cortas por proceso.

De paso apareció que DeepL también quita el punto de las abreviaturas —
"St. Petersburg" volvía como "St Petersburg" en francés y alemán. Eso no es
traducir, es normalizar, y gana la forma que escribió el anfitrión.

### Un bug que encontró un test

Tener a la vez `'St. Petersburg'` y `'St Petersburg'` en la lista hacía que las
dos entradas se pisaran el mapeo, y el resultado perdía el punto. Solo se lista
la forma canónica; la variante sin puntuación se deriva.

### Verificación

```
pnpm build     ✅   pnpm lint      ✅ (0 errores)
pnpm typecheck ✅   pnpm test      ✅ (120 tests, 6 nuevos)
```

Contra la API real de DeepL, los tres idiomas que fallaban:

```
fr: Ton petit coin de paradis avec piscine près de Madeira Beach
    St. Petersburg, Floride, États-Unis
pt: Seu refúgio com piscina perto de Madeira Beach
    St. Petersburg, Flórida, Estados Unidos
de: Dein Rückzugsort mit Pool in der Nähe von Madeira Beach
    St. Petersburg, Florida, USA
```

Gramática natural y nombres propios intactos. Las traducciones automáticas se
borraron y regeneraron; las escritas por personas —el inglés original migrado—
no se tocaron, que es para lo que existe `isMachine`.

## 25. Cambiar de idioma llevaba a un 404

Reportado al usarlo: estando en el sitio y eligiendo otro idioma, la URL pasaba
a `/en/pt` o `/pt/fr` y la página no existía.

### La causa

Dos sitios navegaban a la vez. `setLanguage()` del proveedor ya lo hacía bien,
recorriendo `SUPPORTED_LOCALES`. Pero `changeLanguage()` de la cabecera lo
llamaba **y además hacía su propio `router.push`**, con una copia de la lógica
escrita cuando solo había dos idiomas:

```ts
if (segments[1] === 'en' || segments[1] === 'es') segments[1] = next
else segments.splice(1, 0, next) // ← desde /pt inserta en vez de reemplazar
```

Desde `/pt`, `/fr` o `/de` caía en el `else` y **añadía** el idioma nuevo
delante del viejo. La segunda navegación pisaba a la primera, así que ganaba la
rota.

Es un fallo de la migración a cinco idiomas: actualicé `SUPPORTED_LOCALES` y el
proveedor, y no vi que la cabecera tenía su propia copia. Duplicar esa lógica
fue el error original; el idioma nuevo solo lo hizo visible.

### El arreglo

La cabecera deja de navegar por su cuenta y llama a `setLanguage`. `router` y
`pathname` quedaron sin uso allí y se van con ella.

`stripLocale` y una nueva `pathForLocale` se mueven a `@areia-bela/shared`,
junto a `SUPPORTED_LOCALES`: es su sitio, y así lo que necesite convertir una
ruta a otro idioma la importa en vez de rederivarla.

### Sobre el test

Escribí primero un `.spec.ts` en `apps/web` y luego lo borré: **la app web no
tiene runner de tests**, así que habría sido un archivo que nadie ejecuta, que
es peor que no tener test. Moviendo las funciones a `shared` sí se pueden
probar desde `apps/api`, que es el único paquete con Jest hoy (montarlo en web
es Fase 8, y queda anotado en el propio spec).

El test recorre las **25 combinaciones** de idioma origen/destino y afirma que
ninguna produce dos segmentos de idioma.

### Verificación

```
pnpm build     ✅   pnpm lint      ✅ (0 errores)
pnpm typecheck ✅   pnpm test      ✅ (138 tests, 18 nuevos)
```

- Las cinco rutas de idioma y las profundas (`/fr/checkout`) responden 200.
- Las rutas rotas (`/en/pt`, `/es/en`, `/pt/fr`, `/de/es`) siguen dando 404,
  que es lo correcto: no deben existir. Lo que se arregló es que el selector ya
  no las genera.
- La 404 sale **en el idioma de la ruta** en los cinco casos.

## 26. "Todo sobre la casa", rehecha

Comentario del usuario al verla: parece hecha por alguien junior, está mal
colocada y rompe el esquema. Tenía razón, y el motivo es concreto.

### Por qué desentonaba

Todas las secciones de la portada hablan el mismo idioma visual: tarjeta blanca
`rounded-[32px]` sobre crema, borde `white/70`, sombra larga y suave, antetítulo
en versalitas con icono, títulos en navy `#173a57`, ancho de 1440px.

Esta sección **no usaba nada de eso**: era un acordeón desnudo, sin tarjeta ni
sombra, en una columna centrada de `max-w-3xl` dentro de una página que ocupa 1440. No es que estuviera fea por dentro; es que no pertenecía.

### Por qué no una página aparte ni un modal

Se evaluaron las dos, que era lo que el usuario proponía:

- **Página aparte**: ahí viven las normas, las mascotas y la piscina — el
  contenido que convence de reservar y el que posiciona en buscadores.
  Esconderlo tras un clic pierde las dos cosas.
- **Modal**: ya es un acordeón. Un modal encima serían dos capas de esconder lo
  mismo, y un modal es para una tarea, no para leer prosa larga.

### Qué se hizo

- **Se viste como sus vecinas**: la misma tarjeta, sombra, antetítulo con icono
  y navy que la sección de servicios, que es su hermana más cercana —las dos
  son la mitad práctica de la página.
- **Se movió** de entre reseñas y ubicación a justo después de servicios. Lo
  práctico queda junto, y un muro de prosa deja de cortar el paso de los
  testimonios al mapa y al botón de reservar.
- **Dos columnas** en escritorio: la casa a la izquierda, las preguntas a la
  derecha. Aprovecha el ancho en vez de apilar una debajo de la otra y estirar
  la página una pantalla más.

De paso, sus rótulos (`Conviene saber`, `La casa`, `Preguntas frecuentes`)
estaban escritos a mano en español e inglés, así que en portugués, francés y
alemán caían al español. Pasan a `lib/i18n.ts` en los cinco idiomas, como el
resto de la interfaz.

### Verificación

```
pnpm build     ✅   pnpm lint      ✅ (0 errores)
pnpm typecheck ✅   pnpm test      ✅ (138 tests)
```

- Orden de anclas en el documento: `gallery → amenities → details → reviews →
location`.
- Los rótulos salen en su idioma en los cinco: "Conviene saber", "Good to know",
  "Bom saber", "Bon à savoir", "Gut zu wissen".

## 27. La portada, auditada en cinco idiomas

Revisando el sitio con los cinco idiomas puestos aparecieron tres cosas.

### El cotizador, el modal y el pie seguían en dos idiomas

El patrón era siempre el mismo:

```ts
{
  isEnglish ? 'Cleaning fee' : 'Tarifa de limpieza'
}
```

Un ternario no puede representar cinco idiomas. Con `pt`, `fr` o `de` caía
siempre a la rama española, así que un huésped francés veía la portada en
francés y el desglose del precio en español.

La raíz era un **prop booleano**: `PriceBreakdownCard` y `HostResponseBadges`
recibían `isEnglish: boolean`, que en realidad significaba "inglés o español".
Pasa a `language: Language`, lo que obliga a cada llamante a decir cuál es.

Migrados a `lib/i18n.ts` en los cinco idiomas: el desglose de precio completo
(noches, limpieza, servicio, impuestos, cancelación, descuento), el modal de
contacto con la anfitriona, la barra de reserva del móvil, el pie, las
etiquetas de la anfitriona, el asistente de chat y los `aria-label` de la
cabecera. **Cero ternarios de dos idiomas** en toda la portada.

### El idioma elegido se perdía al volver

`detectLocale` en el middleware tenía el mismo fallo:

```ts
const saved = request.cookies.get('areia_bela_language')?.value
if (saved === 'es' || saved === 'en') return saved // ← 'pt' se ignora
```

Elegir portugués guardaba la cookie que el middleware luego ignoraba, así que
al volver a una ruta sin prefijo el sitio salía en español. De paso el nombre
de la cookie estaba escrito a mano en vez de usar `LANGUAGE_COOKIE`.

Ahora usa la constante y `isSupportedLocale`. Y la negociación de
`Accept-Language` pasa de dos `startsWith` a un lector que respeta los valores
`q` y descarta la región: `fr-CA;q=0.9` es francés, y `en;q=0.3,de;q=0.9` da
alemán aunque el inglés vaya primero. Vive en `@areia-bela/shared` para poder
probarlo.

### "Todo sobre la casa", con más carácter

- **Un icono por sección**, dentro de un círculo que se invierte a navy al
  abrirse. Once filas idénticas de texto navy son un muro; el icono es lo que
  permite encontrar la política de mascotas sin leer cada título.
- **Un contador** junto a cada encabezado de columna: once secciones son
  muchas para abrir a ciegas.
- **Un halo de color** de marca en la esquina, como el de la galería, para que
  un bloque alto de texto no se lea como una caja blanca.
- El panel abierto **se alinea con el texto**, no con el icono.

### Verificación

```
pnpm build     ✅   pnpm lint      ✅ (0 errores)
pnpm typecheck ✅   pnpm test      ✅ (143 tests, 5 nuevos)
```

- Cookie `pt` entrando a `/` con el navegador en español → sitio en portugués.
- Sin cookie y navegador en alemán → sitio en alemán.
- Las cadenas del cotizador y del modal están en el bundle de cliente de `fr`,
  `de` y `pt` (no se ven por `curl` porque el precio llega por fetch y el modal
  solo monta al abrirse).

### Diferido, con su tamaño

**Checkout (33) y confirmación (34) siguen con ternarios de dos idiomas.** No
son la portada, pero es un hueco real del flujo: un huésped francés reserva y
el checkout le sale en español. Son 67 cadenas × 3 idiomas nuevos; se declara
aquí en vez de dejarlo pasar en silencio.

---

## 28. Avisos de reservas, mensajes y cancelaciones

Pedido: que las reservas, los mensajes y las cancelaciones lleguen a Angélica
por correo o WhatsApp, y que ella pueda cambiar el destino desde el panel.

### El formulario de contacto no enviaba nada

Antes de construir los avisos hubo que arreglar lo que ya existía. El
`handleSubmit` de `ContactSection` era esto, completo:

```ts
event.preventDefault()
setSent(true)
event.currentTarget.reset()
```

Un huésped escribía, veía "Mensaje enviado" en verde, y no había ninguna
petición: nadie recibía nada. Los `<input>` tampoco tenían atributo `name`, así
que aunque se hubiera enviado, el `FormData` habría ido vacío.

Ahora `POST /notifications/contact` y el verde solo aparece si el API aceptó.
Si falla, se dice.

### Cómo salen

Dos canales detrás de una interfaz, como ya se hizo con los traductores:

| Canal    | Proveedor                                | Requiere                                                          |
| -------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Correo   | Brevo (el mismo del reset de contraseña) | Nada nuevo                                                        |
| WhatsApp | Twilio                                   | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |

**El correo siempre funciona.** WhatsApp es un añadido: sin las variables de
Twilio no se rompe nada y el panel dice, en su propia sección, qué canal está
activo — no se deduce de la configuración del despliegue.

Se eligió Twilio y no la API de Meta porque Meta exige empresa verificada y una
plantilla aprobada por cada mensaje que inicie el negocio. Cambiar de proveedor
es reemplazar una clase en `notification-channels.ts`.

### Tres decisiones que no son obvias

**Un canal caído no tumba una reserva.** `deliver()` envía a todos los destinos
en paralelo, atrapa cada fallo por separado y lo registra. Si Brevo está caído,
el huésped ya pagó y las fechas ya están tomadas: devolver un error por un aviso
que rebotó desharía algo que sí salió bien.

**El destino de los avisos es un campo aparte del público.** `notifyEmail` y
`notifyWhatsapp` no son `contactEmail` ni `whatsapp`: la dirección a la que
escribe un huésped rara vez es a la que la anfitriona quiere que la despierten a
las 3 de la mañana. Si se dejan vacíos, se usan los públicos.

**Nada de esto escribe a un huésped.** Fuera de una ventana de 24 h que abra el
destinatario, WhatsApp solo entrega plantillas aprobadas. Para el número de la
anfitriona eso se resuelve respondiendo una vez; para huéspedes desconocidos
haría falta un catálogo de plantillas, y no se va a fingir que existe.

### En el panel

Ajustes → Contacto y SEO: a dónde llegan los avisos, tres interruptores
(reserva, cancelación, mensaje) y el estado real de cada canal.

### Limpieza

`needsTranslation()` comparaba `page.body.trim() === page.body.trim()` — un
campo consigo mismo — desde que las dos columnas de idioma se fundieron en una.
Siempre devolvía `true`, y el panel decía "12 secciones por traducir" pasara lo
que pasara. La tarjeta ahora cuenta secciones **sin escribir**, que es un número
sobre el que se puede actuar.

`docs/env.md` seguía anunciando `ANTHROPIC_API_KEY` como la variable de
traducción cuando DeepL ya era el proveedor recomendado (§23).

### Verificación

Contra el API real, no simulado:

```
mensaje del formulario   → HTTP 204 + "Sent ... over Email" en el log
validación               → HTTP 400, 3 errores de campo
límite 3 / 10 min        → 204, luego 429
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (188 tests, 13 nuevos)
```

El endpoint es público y **siempre responde 204**, exista o no la
configuración: un formulario de contacto que distingue casos es un sondeador de
configuración. El límite es por IP, 3 cada 10 minutos.

### Diferido

- **Los avisos van solo en español.** Los recibe la anfitriona, no el huésped.
- **Sin reintentos ni cola.** Un fallo se registra y se pierde. Con el volumen
  de una casa, una cola sería infraestructura por adelantado; queda anotado.
- **El huésped no recibe confirmación por WhatsApp** — ver la regla de 24 h.

---

## 29. Fase 6.3 — la reserva nace del pago

Hasta aquí el sitio cotizaba y cobraba, pero nunca reservaba nada: se pagaba y
no quedaba fila en ninguna tabla. Esta entrada cierra el flujo
`quote → hold → pay → confirm`.

### La carrera, que es el problema de verdad

Dos huéspedes abren la misma semana el mismo martes por la noche. Los dos ven
"disponible", los dos pagan. Comprobar y después insertar son dos operaciones,
y entre una y otra cabe la otra transacción entera. **Ninguna cantidad de
código de aplicación cierra esa ventana** — la base de datos tiene que negarse.

```sql
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist (
    "propertyId" WITH =,
    daterange("checkIn"::date, "checkOut"::date, '[)') WITH &&
  ) WHERE ("status" <> 'CANCELLED');
```

Tres detalles que costaron pensarlos:

- **`'[)'`** — el día de salida es el día de llegada del siguiente. Con `'[]'`,
  Sep 1–8 y Sep 8–15 se solaparían y la casa perdería una noche entre cada dos
  reservas.
- **`btree_gist`** — es lo que permite meter una columna de igualdad
  (`propertyId`) en el mismo índice GiST que un rango. Hoy hay una sola casa;
  dejarla fuera haría la restricción incorrecta en cuanto eso cambie.
- **El predicado no puede llamar a `now()`.** Una expresión de índice tiene que
  ser inmutable, así que la restricción no sabe distinguir un `hold` vigente de
  uno vencido. Lo resuelve el servicio: cancela los vencidos **dentro de la
  misma transacción** que hace el `INSERT`. Un test comprueba ese orden, porque
  invertirlo no rompe nada visible hasta que alguien pierde una reserva.

### Un `hold`, no una reserva

`POST /bookings/:slug/hold` crea la fila en `PENDING` con `expiresAt` a 30
minutos. Treinta y no quince porque **Stripe rechaza una sesión que caduque
antes de media hora**: un hold más corto liberaría las fechas con el huésped
todavía en la pasarela.

El precio lo calcula el mismo `PropertiesService.getQuote` que usa el cotizador.
No hay una segunda ruta de precios que pueda desviarse de la primera.

### Solo Stripe confirma

`POST /bookings/stripe-webhook` verifica la firma sobre el **cuerpo crudo**
(`NestFactory.create(AppModule, { rawBody: true })` — un JSON reserializado
nunca coincide). Es lo único que puede pasar una reserva a `CONFIRMED`.

La redirección de éxito no puede: es una URL que visita el navegador del
huésped, y un navegador que confirma su propia reserva es un navegador que
reserva gratis. La página de confirmación **pregunta** por la reserva, no la
declara.

El importe se lee de `session.amount_total`, que viene dentro del payload
firmado. Si no coincide con lo cotizado se registra como error pero **la
reserva se confirma igual**: el huésped ya pagó, y dejarlo sin fechas por un
descuadre de centavos es peor que revisarlo a mano.

Idempotente, porque Stripe reintenta lo que no recibió un 2xx.

### Lo que estaba mintiendo

Dos pantallas afirmaban cosas que no eran ciertas:

- **La página de confirmación decía "¡Reserva confirmada!"** leyendo
  `localStorage`. Sin pago, sin reserva, sin comprobar nada — bastaba visitar
  la URL. Ahora consulta `GET /bookings/session/:id` y distingue tres estados:
  confirmada, pagada-pero-todavía-confirmándose (el webhook tarda unos
  segundos, así que la página reintenta), y no encontrada.
- **"Tu reserva está protegida por AirCover"**, en el checkout y en la
  confirmación. AirCover es el programa de Airbnb. Esto es una reserva directa:
  esa protección no existe aquí. Sustituido por lo que sí es verdad — que el
  pago lo procesa Stripe y la casa nunca ve la tarjeta.
- **"Correo de confirmación enviado a tu bandeja"** tampoco se enviaba. Ahora
  sí, en los cinco idiomas, con la referencia y los horarios reales de la casa.

Los botones "Descargar recibo" y "Compartir viaje" no hacían nada. Fuera.

### La referencia

`AB-` más seis caracteres. Sin `I`, `O`, `S`, `0` ni `1`: se dictan por
teléfono. El `5` se queda — sin `S` en el alfabeto no puede confundirse.
Un test lo verifica, y de paso pilló que el comentario decía una cosa y el
alfabeto otra.

### En el panel

`/admin/reservations` deja de ser un cartel de "próximamente". Muestra próximas
y pasadas, con estado, huésped, contacto, extras y su nota; permite cancelar
con motivo. Cancelar libera las noches al instante y avisa a la anfitriona.

Un `VIEWER` puede mirar; cancelar es de `MANAGER` para arriba.

### Verificación

Contra el API y Postgres reales, no simulados:

```
dos peticiones simultáneas, misma semana → 201 y 409, 1 fila
semana contigua (salida = llegada)       → 201
hold vencido                             → el calendario la da por libre
otro huésped la reserva                  → 201, el vencido queda CANCELLED
webhook sin firma                        → 400, sigue PENDING
webhook con firma inválida               → 400, sigue PENDING
webhook con firma válida                 → 200, CONFIRMED, expiresAt = NULL
el mismo evento otra vez                 → 200, "ignoring repeat webhook"
cuerpo alterado con la firma vieja       → 400
GET /bookings sin sesión                 → 401
PATCH /bookings/:id/cancel sin sesión     → 401
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (206 tests, 18 nuevos)
```

### Entidades

Ninguna nueva. `Booking`, `Customer` y `BookingExtra` ya estaban en la lista
canónica de `CLAUDE.md`; se les añadieron columnas (`reference`, `expiresAt`,
`stripeSessionId`, `paidAt`, `cancelledAt`, `cancellationReason`, `pets`,
`locale`).

### Diferido, con su tamaño

- **Sin reembolso automático al cancelar.** El dinero de vuelta es una decisión,
  no el efecto secundario de un clic; hoy se resuelve en Stripe. Es lo que
  queda de Fase 7 junto con el panel de pagos.
- **Sin mínimo de noches ni temporada de piscina climatizada.** Siguen siendo
  Fase 6; el motor de precios ya sabe de temporadas, falta exponerlo.
- **El checkout no valida los campos del huésped antes de enviar.** Si faltan,
  el API responde 400 y la página muestra el mensaje genérico. Debería
  bloquear el botón antes.
- **`checkout.session.expired` libera el hold, pero nada barre los vencidos si
  nadie más reserva.** Sin un cron, un hold abandonado queda `PENDING` en la
  tabla hasta la siguiente reserva. El calendario y el panel ya lo ignoran, así
  que es ruido en una tabla, no una fecha bloqueada — pero es deuda.
- **El huésped no puede cancelar.** Solo la anfitriona, desde el panel.

---

## 30. Dos rutas que nunca existieron

Errores reportados al probar el flujo recién construido. Ninguno de los dos era
nuevo; los dos llevaban tiempo ahí.

### `GET /cms/settings` devolvía 404

`CmsService` tenía `getSettings()` y el panel llamaba a `GET /cms/settings`,
pero **solo se había declarado el `@Patch`**. La ruta de lectura no existía.

El formulario de Ajustes → Contacto y SEO recibía un 404 al cargar, `draft` y
`stored` se quedaban en `null`, y la pantalla mostraba sus esqueletos para
siempre. Toda esa sección era inutilizable — incluidos los destinos de avisos
de §28, que se podían guardar pero no volver a ver.

Verificado el ciclo completo contra el API real: `PATCH` guarda,
`GET` devuelve lo guardado, `401` sin sesión.

### El botón de pagar no era el botón del formulario

`POST /api/checkout` respondía `400 Missing guest details` aunque los campos
estuvieran en pantalla. La causa: el `<form>` de datos del huésped está en una
sección y el botón "Confirmar y pagar" en otra, y el botón llamaba a
`handleSubmit` por `onClick`.

Un `onClick` no es un envío de formulario. **El navegador nunca comprobó ni un
solo `required`**, así que el formulario se enviaba vacío y el 400 llegaba
desde el API, donde ya no hay forma de señalar qué campo falta.

Se arregla con `form="checkout-form"` en el botón, que lo convierte en el
submit de ese formulario aunque esté fuera de él: la validación nativa vuelve a
correr y el navegador enfoca el primer campo vacío. Queda además una
comprobación en `handleSubmit` y un mensaje traducido, para que un fallo de
validación nunca se muestre como "no pudimos abrir la página de pago".

Esto estaba declarado como diferido en §29 ("el checkout no valida los campos
del huésped antes de enviar"). Resultó no ser una falta de validación sino un
botón desconectado, que es peor: la validación estaba escrita y no se ejecutaba.

### Verificación

```
GET /cms/settings sin sesión → 401 (antes: 404)
GET /cms/settings con sesión → los ajustes, con los campos de avisos
PATCH y releer               → conserva notifyEmail, notifyWhatsapp y los interruptores
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (206 tests)
```

---

## 31. El pago sin webhook, y el caso peor que destapó

Un pago real de prueba: $1245 cobrados en Stripe, y la página de confirmación
diciendo "No encontramos esa reserva". El pago estaba bien; el aviso nunca
llegó, porque sin `STRIPE_WEBHOOK_SECRET` ni `stripe listen` nada le cuenta al
API que la tarjeta pasó. Eso es configuración, no un fallo — pero destapó dos
cosas que sí lo eran.

### Decirle "no encontramos tu reserva" a alguien que acaba de pagar

`GET /bookings/session/:id` busca por `stripeSessionId`, que solo se escribe al
confirmar. Entre el pago y el webhook, la reserva es invisible para esa
consulta, y la página caía en el peor mensaje posible: el que sugiere que el
dinero se perdió.

Volver de Stripe con un `session_id` en la URL **prueba que la tarjeta pasó**.
Ahora la página distingue ese caso y dice que el pago se procesó y la reserva
está tardando, con la referencia a la vista — guardada en `sessionStorage` de
camino a Stripe, así que está disponible aunque el API todavía no sepa nada.

Sin `session_id` sigue mostrando el mensaje de enlace incompleto, que ahí sí es
verdad.

### Un pago que se queda sin fechas

El caso serio. Un `hold` dura 30 minutos. Si el huésped paga en el minuto 29 y
el webhook tarda, el barrido de la siguiente reserva cancela su `hold` —
`PENDING` y vencido es exactamente lo que barre. Cuando el webhook por fin
llega, `confirmPayment` se encontraba una reserva `CANCELLED` y **no hacía
nada**: dinero cobrado, sin fechas, sin aviso a nadie.

Ahora intenta reconfirmarla, y quien decide si se puede es la restricción de
exclusión:

- **Nadie tomó esas fechas** → se restaura a `CONFIRMED` y sigue su curso.
- **Otro huésped ya las reservó** → Postgres lanza `23P01` y sale un aviso
  aparte, `ACCIÓN REQUERIDA · pago sin fechas`, con la referencia y el id de
  la sesión de Stripe para devolver el dinero.

Ese aviso **ignora los interruptores del panel**. Apagar los avisos de reserva
es una decisión sobre ruido; no es una renuncia a enterarse de que hay que
devolver dinero.

### Verificación

Con el pago real, reenviando el evento firmado que Stripe habría mandado:

```
webhook firmado          → 200, AB-JJYK9R pasa a CONFIRMED, expiresAt = NULL
```

Y las fechas, que era la pregunta:

```
31 jul – 2 ago   ocupadas          3 ago en adelante  libre
mismas fechas            → 409     contenida          → 409
solapa el inicio         → 409     empieza al salir   → 201
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (208 tests, 2 nuevos)
```

### Pendiente del usuario

`STRIPE_WEBHOOK_SECRET` con un valor de verdad. En local sale de
`stripe listen --forward-to localhost:3001/bookings/stripe-webhook`; en
producción, del panel de Stripe. Sin él las reservas se quedan en `PENDING`
para siempre y hay que confirmarlas a mano.

---

## 32. El calendario del panel, que solo contaba media historia

Dos huecos reportados: las reservas no aparecían en el calendario del admin, y
bloquear fechas a mano no existía.

### Faltaba media capa

El calendario cargaba `blocked-dates` y nada más. Una reserva pagada dejaba el
día pintado como libre, así que la única pantalla donde la anfitriona mira
"¿qué tengo este mes?" no mostraba lo único que le importa.

Ahora carga las dos cosas, y **las distingue**: verde para reservada, con el
nombre del huésped en la celda; el color de marca para bloqueada. No son lo
mismo — una es dinero y alguien llegando, la otra es una decisión suya — y
"no disponible" a secas no dice si puede hacer algo al respecto.

### Bloquear no estaba construido

`getBlockedDates` era de solo lectura y el botón "Bloquear fechas" mostraba un
aviso de "próximamente". Faltaban las dos rutas:

- `POST /properties/:slug/blocked-dates` — rango y motivo
- `DELETE /properties/blocked-dates/:id` — libera las noches

**El bloqueo se niega a tapar una reserva viva.** Nada en la base lo impedía:
la restricción de exclusión protege reservas entre sí, no contra `BlockedDate`.
Sin esa comprobación, la anfitriona podía hacer desaparecer del calendario a un
huésped que ya pagó, mientras su reserva seguía existiendo. Ahora devuelve 409
nombrando la reserva que estorba.

Un `hold` vencido no cuenta como estorbo: un checkout abandonado no es razón
para impedirle cerrar la semana.

En la interfaz: dos clics (primera noche, última noche) en vez de arrastrar —
arrastrar es mejor con ratón e inservible en el teléfono que la anfitriona
lleva encima. Pide un motivo opcional, porque dentro de tres meses "¿por qué
está cerrado octubre?" merece respuesta. Un clic en un día bloqueado lo libera,
tras confirmar.

Un `VIEWER` ve el calendario pero no cierra la casa.

### De paso

La pantalla de mantenimiento usaba `calendar.comingSoon` para su propio botón
sin construir. Al desaparecer esa cadena se le dio la suya, que además dice la
verdad concreta: las tareas de mantenimiento no están hechas y ese botón no
hace nada a propósito.

### Verificación

Contra el API real:

```
bloquear 10–14 sep                → 201, con motivo
el calendario público             → esos cinco días dejan de estar disponibles
un huésped reserva 11–13 sep      → 409
bloquear sobre AB-JJYK9R          → 409 "Those dates hold booking AB-JJYK9R"
liberar el rango                  → 204, el 11 vuelve a estar libre
VIEWER bloqueando                 → 403
VIEWER leyendo el calendario      → 200
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (216 tests, 8 nuevos)
```

### Diferido

- **El calendario del panel muestra un mes.** Para bloquear un rango que cruza
  meses hay que navegar entre ellos con la selección a medias, y funciona, pero
  es incómodo. Dos meses lado a lado como en el cotizador sería mejor.
- **No se puede editar el motivo de un bloqueo** sin liberarlo y rehacerlo.

---

## 33. El calendario ofrecía fechas vendidas

Un 409 al reservar, con las fechas de una reserva confirmada. La respuesta era
correcta — esa semana ya estaba pagada — pero el huésped **nunca debió poder
elegirla**.

### La causa

```tsx
disabled={[{ before: today }, ...blockedRanges]}
```

Solo los bloqueos del anfitrión. Las reservas no aparecían, así que una semana
vendida se veía igual que una libre y el 409 llegaba al final del formulario,
después de escribir nombre, correo y teléfono.

Peor: el componente **ya pedía la disponibilidad**. `GET /rates` devuelve
`available` por noche desde siempre; la tarjeta se quedaba con el precio y
tiraba ese campo:

```ts
setRates(new Map(nights.map((night) => [night.date, night.rate])))
```

Ahora conserva las dos cosas. Una noche tomada aparece tachada, no se puede
seleccionar, y no muestra precio — cotizar algo que no está a la venta no
ayuda a nadie. El 409 sigue ahí como última línea, que es donde debe estar.

### Huéspedes

La pantalla llevaba un cartel de "aparecerán aquí cuando haya reservas". Ya las
hay, así que se construyó: `GET /customers`, con estadías, noches, lo gastado y
la próxima llegada de cada uno. Quien repite lleva una marca — es la reserva
más barata que esta casa va a conseguir.

**Una fila de `Customer` no es un huésped.** Se escribe en cuanto alguien
empieza un checkout, así que un carrito abandonado deja una detrás. La lista
excluye a quien no tenga ninguna reserva que sobreviviera; una lista inflada
con gente que nunca vino es una lista que nadie mira. Y solo suma dinero con
`paidAt`: un hold en vuelo no es ingreso.

### El panel

Las cuatro cifras eran noches libres, tarifa base, fotos y secciones sin
escribir. Tres de las cuatro son de mantenimiento del sitio, no de llevar una
casa.

Ahora, en el orden en que hacen falta:

- **La próxima llegada**, en su propia tarjeta con quién, cuándo, cuántas
  noches y cuántos días faltan. Es la pregunta por la que se abre el panel;
  como una casilla entre cuatro quedaba enterrada.
- Noches reservadas de las próximas 30, confirmado de los próximos 30 días,
  cobrado hasta hoy, y cuántos están pagando **ahora mismo** — el único número
  aquí que puede cambiar en veinte minutos.
- Un aviso de "para mirar" con los holds en vuelo y las noches bloqueadas, que
  **solo aparece cuando hay algo que hacer**. Un panel de alertas siempre
  visible y siempre vacío enseña a no leerlo.
- La lista de próximas llegadas, en lugar de la tarjeta que decía "no hay
  reservas todavía" y ya no era verdad.

### Verificación

```
rates 30 jul – 4 ago      → 31 jul, 1 y 2 ago no seleccionables, sin precio
GET /customers            → Erick Giraldo · 1 estadía · 3 noches · $1245
un Customer sin reservas  → no aparece en la lista
cifras del panel          → próxima llegada en 1 día · 3/30 noches · $1245
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (220 tests, 4 nuevos)
```

### Diferido

- **Las notas por huésped no se pueden editar.** El campo `notes` existe en
  `Customer` y se muestra, pero no hay dónde escribirlo.
- **El panel calcula en el navegador** a partir de `/bookings`. Con una casa es
  trivial; con años de historial convendría un endpoint que agregue.

---

## 34. El 409 llegaba tarde y en silencio

Cinco huecos, todos con la misma raíz: pantallas que sabían menos de lo que el
API ya les contaba.

### El aviso llega al entrar, no al pagar

Seguía saliendo un 409 al reservar. La respuesta era correcta y el calendario
ya no ofrece fechas vendidas (§33), pero se puede llegar al checkout con un
enlace viejo, o quedarse una hora en la página mientras otro paga esa semana.

Ahora el checkout **comprueba la disponibilidad al cargar**. Si las noches no
están libres: un toast, un aviso rojo permanente con un botón a elegir otras
fechas, y el botón de pagar desactivado. Enterarse después de escribir nombre,
correo y teléfono era el peor momento posible.

El sitio público no tenía `Toaster`; se añadió al layout, arriba y al centro,
que es donde mira quien acaba de pulsar "Confirmar y pagar".

### El cotizador abría en fechas vendidas

`addDays(today, 1)` a `addDays(today, 4)`, sin mirar quién estaba en la casa
esos días. Con una reserva mañana, la tarjeta abría directamente sobre ella.

Ahora, cuando llegan las tarifas, busca la primera racha de tres noches libres
y se mueve ahí — solo si lo que hay seleccionado está ocupado, para no pisar lo
que el huésped acabe de elegir.

### Colores

Un solo color decía "no disponible" para dos cosas distintas. Ahora, en las
tres pantallas:

|                    | Reservada                         | Bloqueada por el anfitrión |
| ------------------ | --------------------------------- | -------------------------- |
| Panel y calendario | verde, con el nombre del huésped  | gris pizarra               |
| Sitio público      | tachado, gris, con trama diagonal | igual                      |

El huésped no necesita saber por qué la casa no está libre, así que ahí las dos
se ven igual. La anfitriona sí: una es dinero, la otra es una decisión suya.
Ninguna descansa solo en el color — hay leyenda, tooltip y, en el sitio,
tachado.

### "La casa, próximas tres semanas" no mostraba las reservas

El mismo fallo que tenía el calendario y que se arregló en §32: el componente
solo leía `blocked-dates`. Una estadía pagada aparecía como noche libre **en la
primera franja de la primera pantalla** del panel. Ahora lee las dos fuentes,
las distingue, y pone el nombre del huésped en la primera noche de cada
estadía.

### Bloquear una sola noche era imposible

El diálogo solo se abría con `from && to`, y un clic solo fijaba `from`. Una
noche suelta — una revisión de la piscina, un día entre huéspedes — no se podía
bloquear de ninguna manera. Ahora un segundo clic en el mismo día cierra el
rango, y el texto lo dice para que se descubra. El resumen colapsa a "Una
noche" en vez de "del 15 de octubre al 15 de octubre".

### Huéspedes: crear, editar, eliminar

`POST`, `PATCH` y `DELETE /customers`, con notas privadas editables — el campo
existía en el modelo y se mostraba, pero no había dónde escribirlo.

Dos negativas deliberadas:

- **No se borra a alguien con reservas.** Su fila es de lo que cuelga una
  estadía; borrarla dejaría una reserva sin nombre. 409, nombrando el motivo.
- **Un correo duplicado se nombra.** Es el único fallo que la anfitriona puede
  arreglar; el resto son nuestros y un mensaje específico solo confundiría.

Esto obligó a afinar quién sale en la lista. Antes se filtraba por "tiene
reservas vivas", lo que habría escondido a un huésped recién creado a mano. La
distinción real: **un hold siempre escribe una fila de `Booking`**, así que
alguien con cero reservas en total fue añadido por una persona, y alguien con
reservas todas canceladas es un checkout abandonado. Los primeros se muestran,
los segundos no.

### Verificación

```
crear a mano                      → 201, aparece con "todavía sin estadías"
editar teléfono y nota            → 200, persiste
correo duplicado                  → 409
borrar a quien tiene reservas     → 409 "has bookings and cannot be deleted"
borrar a quien nunca vino         → 204
bloquear una sola noche           → 201, solo el 15 de octubre deja de estar libre
primera estadía libre de 3 noches → 3 ago (31 jul, 1 y 2 ago están vendidos)
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (225 tests, 5 nuevos)
```

### Diferido

- **El calendario del panel sigue mostrando un mes**, así que un bloqueo que
  cruza meses obliga a navegar con la selección a medias.
- **No se puede crear una reserva desde el panel.** Se puede añadir al huésped,
  pero una estadía tomada por teléfono todavía no tiene por dónde entrar.

---

## 35. En el cotizador, hoy se veía igual que un día elegido

El calendario del huésped usa el componente compartido, que pinta el día actual
con `bg-accent`. En este sitio `--accent` es `#173a57`, y el día seleccionado
es `#174d7a`: **dos azules oscuros a un dígito de distancia**. Hoy parecía una
fecha ya elegida, y el rango entre llegada y salida era un bloque macizo sin
principio ni fin visibles.

### Lo que se ve ahora

| Estado              | Antes                         | Ahora                                         |
| ------------------- | ----------------------------- | --------------------------------------------- |
| Hoy                 | relleno azul oscuro           | anillo azul, sin relleno, número en negrita   |
| Llegada y salida    | azul `#174d7a`                | igual, en círculo, los únicos bloques sólidos |
| Noches entre medias | azul `#173a57`, casi idéntico | banda al 10%, esquinas rectas                 |
| No disponible       | tachado y gris                | tachado, gris y con trama diagonal            |

El rango pasa a leerse como lo que es: **dos extremos y una banda**. Antes los
tres estados competían por el mismo peso visual.

### El detalle que hacía falta comprobar

Dos mecanismos distintos, y confundirlos habría dejado el arreglo a medias:

- **`classNames`** se esparce al final del objeto del componente compartido, así
  que cada clave que se pasa **reemplaza la suya entera**. Por eso `bg-accent`
  desaparece de `today` sin pelearse con él.
- **El `className` del `DayButton`** sí pasa por `cn()`, que es `twMerge`. Ahí
  el override de `data-[range-middle=true]:bg-accent` funciona porque
  tailwind-merge las reconoce como la misma propiedad bajo la misma variante.
  Se verificó ejecutando `twMerge` sobre las dos listas antes de dar por bueno
  el cambio.

### Leyenda

Tres rellenos en una cuadrícula es justo donde una leyenda deja de ser adorno.
Se añadió bajo el calendario, en los cinco idiomas, con la muestra de "tu
estadía" dibujada como extremo-banda-extremo en vez de un cuadrado de color.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (225 tests)
```

---

## 36. Fase 6, cerrada: lo que quedaba de su alcance

Faltaban los dos ítems del plan que no eran el flujo de pago: **mínimo de
noches** y **temporada de piscina climatizada**.

### Extras que nadie podía comprar

Este era el hueco serio. `heated-pool` ($20/noche, 1 oct – 1 may) y
`certified-nanny` ($20/hora) llevan en la base desde Fase 3, y el motor los
cobra correctamente — temporada, unidades por hora, todo. Pero **el cotizador
solo mandaba `pet`**. Eran cargos sin ninguna forma de incurrir en ellos.

Se añade `StayExtras` en el checkout, antes del formulario de datos: primero se
decide qué se compra, después se dan los datos. Al revés significa teclear un
teléfono y encontrarse una línea nueva en el total.

**La trampa que costó encontrarla.** El API devuelve cada extra con `id` (cuid)
y `key`, y `pricingInputFor` renombra `key` a `id` al construir la entrada del
motor. Un `extraIds: ['<cuid>']` no falla: cotiza el extra a cero y la línea
simplemente no aparece. La primera versión del componente usaba el cuid y las
tres pruebas de temporada daban `$0`, incluso en enero. Queda documentado en el
tipo del componente.

Verificado que la temporada hace lo suyo:

```
enero  (5 noches, en temporada) → 5 noches de piscina · $100
julio  (5 noches, fuera)        → 0 noches            · $0
28 abr – 4 may (6 noches)       → 4 noches            · $80
```

Ese último es el caso que importa: la temporada **cruza el fin de año** (oct →
may), y una estadía a caballo del 1 de mayo se cobra solo por las noches que
caen dentro. La interfaz lo dice — "4 de tus noches" — porque un total que el
huésped no puede reconciliar es un total que no se cree.

Dos extras no están ahí a propósito: la mascota vive en el selector de
huéspedes, donde uno piensa en el perro, y el huésped adicional se cobra solo a
partir del tamaño del grupo.

### Mínimo y máximo de noches

No existían en ningún sitio. `Property` gana `minNights` y `maxNights`, con los
valores del listing real (`datos.json`): 1 y 365.

**La cotización no falla, señala.** Una estadía demasiado corta se sigue
cotizando y devuelve `stayLength: { kind: 'tooShort', minNights }`. Un 400
dejaría la tarjeta de precio en blanco a cada cambio de fecha y el huésped
nunca sabría cuál es el límite. Quien se niega es `POST /bookings/hold`, que es
el que cobra.

El calendario también lo aplica, con un detalle de una línea que era un error
latente: `min` en react-day-picker cuenta **días seleccionados**, y la salida
es una mañana, no una noche. Estaba en `min={1}`, que permitía elegir el mismo
día dos veces — cero noches. Ahora es `minNights + 1`.

### Reglas de la estadía, editables

Cuatro números que solo vivían en la base: mínimo, máximo, porcentaje de
descuento largo y desde cuántas noches aplica. Los dos últimos estaban
documentados como "editable desde el admin" en `docs/domain-decisions.md` pero
**no figuraban en `UpdatePropertyDto`**: guardarlos era imposible.

El servidor rechaza un mínimo mayor que el máximo, comparando contra lo
almacenado cuando el PATCH trae solo uno de los dos. Sin eso, la casa quedaría
imposible de reservar sin que nada lo dijera.

### Verificación

Con el mínimo en 3 y el máximo en 30:

```
cotizar 2 noches   → $870 y stayLength=tooShort   hold → 400 "at least 3 nights"
cotizar 4 noches   → $1620, reservable            hold → 201
cotizar 44 noches  → $14970 y stayLength=tooLong  hold → 400 "at most 30 nights"
```

Y las reglas desde el panel:

```
PATCH min=2 max=90 descuento=15% desde 5 noches → 200, persiste
PATCH minNights=100 (máximo 90)                 → 400
4 noches → descuento $0    ·    5 noches → descuento $225
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (231 tests, 6 nuevos)
```

### Criterio de salida de Fase 6

| Requisito                                         |         |
| ------------------------------------------------- | ------- |
| Dos peticiones simultáneas dejan una sola reserva | ✅ §29  |
| Un hold vencido devuelve sus noches               | ✅ §29  |
| `CONFIRMED` solo con webhook firmado              | ✅ §29  |
| Reservas visibles y cancelables en el panel       | ✅ §29  |
| Mínimo de noches                                  | ✅ aquí |
| Temporada de piscina climatizada                  | ✅ aquí |
| `build/lint/typecheck/test` en verde              | ✅      |

**Pendiente del usuario, no del código:** `STRIPE_WEBHOOK_SECRET` con un valor
real. Sin él cada pago se queda en `PENDING` y hay que confirmarlo a mano.

### Diferido a Fase 7

- Reembolso automático al cancelar, y panel de pagos.
- Crear una reserva desde el panel (una tomada por teléfono).
- Mínimos por temporada: hoy el mínimo es uno para todo el año, y lo habitual
  es exigir más noches en las fechas altas. Se declara porque el modelo actual
  no lo soporta sin una columna nueva en `PriceRule`.

---

## 37. Stripe se muda entero al backend

Observación del usuario, y tenía razón: la clave secreta de Stripe estaba en
`apps/web`.

Nunca llegó a un navegador — la usaba un route handler de Next, que corre en el
servidor — pero repartía la responsabilidad del pago entre dos aplicaciones
cuando el precio, la reserva y el webhook viven todos en el API. Dos entornos
con la misma clave es el doble de sitios donde puede filtrarse, para nada.

Ahora `POST /bookings/:slug/hold` cotiza, reserva las fechas **y abre el pago**
en una sola llamada, devolviendo `checkoutUrl`. El route handler
`apps/web/app/api/checkout/route.ts` se borró, y `apps/web` **no tiene ninguna
credencial de Stripe**.

### La variable que no leía nadie

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` estaba documentada como requerida y no
aparecía en una sola línea de código. Serviría para cargar Stripe.js con un
formulario de tarjeta propio; el sitio redirige a la página alojada de Stripe,
así que nunca hizo falta. Eliminada de `.env`, de los `.env.example` y de
`docs/env.md`.

### El origen de las URLs de vuelta

Stripe rechaza una URL de retorno relativa, y el route handler la sacaba de
`req.headers.origin`. Al mudarse al API había que decidir de dónde sale ahora.

Se conserva la cabecera `Origin` **pero validada contra `CORS_ORIGINS`**, la
misma lista que ya restringe quién puede llamar. Sin eso, cualquiera podría
crear un hold cuya URL de éxito apunte a un sitio suyo. Un `Origin` ausente o
ajeno responde 400.

### Stripe fuera de la transacción

La sesión se crea **después** de cerrar la transacción de base de datos. Es una
llamada de red a un servicio de terceros, y mantener abierta la transacción que
sostiene la restricción de exclusión mientras Stripe responde sería un candado
sobre el calendario entero durante lo que tarde Stripe.

### Verificación

```
hold con Origin válido      → 201, AB-2HARTB, $1245, URL de checkout.stripe.com
hold con Origin ajeno       → 400 "Unknown origin"
hold sin Origin             → 400 "Unknown origin"
grep STRIPE en apps/web     → 0 resultados
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (231 tests)
```

### Seguridad — hallazgo aparte

Auditando el historial de git para responder qué significa rotar una clave,
apareció que `.env.backup`, `apps/web/.env.backup` y `apps/api/.env.backup`
**están commiteados** y contienen `STRIPE_SECRET_KEY` real. El repositorio
`T-SOLUCIONO/Areia-Bela` es **público**, y la clave del historial es la misma
que estaba en uso.

Atenúa mucho la gravedad que sea `sk_test_`: no mueve dinero real ni da acceso
a datos de clientes. Pero hay bots que rastrean GitHub buscando este patrón
exacto.

Ya estaba anotado como pendiente en `docs/current-analysis.md` y en los quick
wins del plan desde antes de esta fase. **Es una acción manual del usuario:**
rotar en Stripe (modo test → API keys → Roll key) y, si se quiere, purgar el
historial con `git filter-repo`. La purga limpia pero no rescata: con un repo
público hay que asumir que la clave pudo ser leída.

---

## 38. El huésped entra a ver su reserva, sin contraseña

Pedido: que el huésped pueda entrar a revisar sus reservas y sus datos, y
descargar un PDF de la reserva.

### Enlace por correo, no contraseña

Una contraseña sería una credencial que el huésped tiene que inventar,
recordar y probablemente reutilizar, para una o dos estadías al año — y una
cosa más que esta casa guarda y de la que responde. El correo ya es el
identificador bajo el que se hace una reserva, así que demostrar que se
controla es prueba suficiente.

`GuestLoginToken` es entidad nueva y se justifica: misma forma que
`PasswordResetToken` — hasheado, de un solo uso, 15 minutos — porque es el
mismo problema, un secreto viajando por correo. **Los huéspedes se autentican
contra `Customer`, nunca contra `User`.** Son poblaciones distintas con poderes
distintos, y una tabla compartida está a un bug de que un huésped tenga un rol
de staff.

`POST /guest/login` responde **204 siempre**, exista o no ese correo.
Contestar distinto lo convertiría en una forma de preguntarle a la casa si
alguien concreto se ha alojado aquí.

### El agujero que abrí y cerré antes de seguir

Las sesiones de huésped se firman con `JWT_ACCESS_SECRET`, el mismo del panel.
El guard del staff verificaba **sin comprobar la audiencia** y aceptaba
`Authorization: Bearer`, así que un huésped podía presentar su propio token y
quedar autenticado — con `role: undefined`, bloqueado en las rutas con
`@Roles`, pero **no en las que solo exigen sesión**.

Se cierra rechazando cualquier token con `aud`, igual que ya se hacía con el
claim `purpose` del reto de 2FA. Los tokens del staff no llevan audiencia, así
que cualquier `aud` no es de los nuestros.

Verificado que es ese arreglo el que actúa, no otra cosa:

```
token sin aud → 401 "Account is no longer active"   (pasó el guard, murió después)
token aud=guest → 401 "Invalid or expired access token"  (lo corta el guard)
```

### Todo se filtra por la sesión

Ninguna ruta del área acepta un identificador: el servidor consulta por quien
diga la cookie. Una referencia en una URL no es una credencial.

```
AB-T45RMB (de otro huésped) con la sesión de Erick → 404
/guest/me y /guest/bookings sin sesión             → 401
```

El correo **no es editable** desde dentro de la sesión: es el identificador del
que cuelgan sus reservas y la dirección a la que va su enlace de acceso, así
que cambiarlo desde dentro sería una forma de apropiarse de una cuenta con una
cookie robada. Cambiarlo es una conversación con la anfitriona.

### El PDF

Se genera en el servidor con `pdfkit`, no en el navegador: así salen los mismos
bytes le pida quien le pida y con lo que sea, y las cifras son las almacenadas,
no algo que una página recalculó.

Solo español e inglés. Un PDF es un artefacto casi legal que la gente reenvía a
terceros, y uno traducido a máquina es peor que uno en un idioma que al menos
se reconoce. Los cinco idiomas del sitio son otra promesa.

Al revisarlo salió un fallo: el pie imprimía **la dirección dos veces**, porque
`Property.address` ya es la línea completa y encima se le añadían `city`,
`state` y `country`.

### Rediseño: la estadía como una banda

El componente `StayBand` dibuja una estadía como lo que es — dos extremos
anclados y el tramo entre ellos — la misma forma que el calendario usa para un
rango seleccionado. Un huésped que eligió sus fechas en la portada se
reencuentra con esa figura en la confirmación y en su historial. Cuatro datos
sueltos en una cuadrícula se leen como cuatro hechos; esto se lee como una
estadía, que es lo que compró.

### Lo que se quitó del checkout

La sección "Pago" encabezaba con `Visa · Mastercard · Amex · Discover` y un
icono de tarjeta. **Esta página nunca ve una tarjeta** — eso ocurre en la
página de Stripe — así que esa fila anunciaba una capacidad que no tiene, y
ponerla sobre el total daba a entender que la tarjeta se introducía ahí.

### Verificación

```
pedir enlace: con reserva y desconocido → 204 los dos, indistinguibles
correo real enviado por Brevo           → "Email sent to egiraldom@outlook.com"
canjear el enlace                       → entra como Erick Giraldo
reusarlo                                → 401 (un solo uso)
editar teléfono                         → guarda; editar el correo → 400
PDF                                     → 200, application/pdf, 1 página, con logo
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (231 tests)
```

### Checklist de seguridad, para esta pieza

|                                                                 |            |
| --------------------------------------------------------------- | ---------- |
| Cookie `HttpOnly`, `Secure` en producción, `SameSite` explícito | ✅         |
| Rate limiting en el envío de enlaces (5 cada 15 min)            | ✅         |
| El endpoint no revela si un correo existe                       | ✅         |
| Token hasheado, un solo uso, vida corta                         | ✅         |
| Sin auth de demo ni formularios prellenados                     | ✅         |
| Variables documentadas por nombre en `docs/env.md`              | ✅         |
| **Sin rotación ni revocación de la sesión**                     | ⚠ diferido |

Lo último, explícito: la sesión de huésped es un JWT de 7 días sin refresh
rotado ni tabla de revocación. Es una decisión de proporción — un huésped ve
sus propias reservas y edita su propio teléfono — pero significa que una cookie
robada vale una semana y no hay forma de matarla desde el panel. El staff sí
tiene rotación. Se declara aquí en vez de omitirlo.

### Diferido

- **La confirmación y el checkout siguen con ternarios de dos idiomas** en las
  partes que no toqué. Las cadenas nuevas van en los cinco.
- **El PDF no se puede descargar desde la confirmación**, solo desde el área
  del huésped, porque ahí todavía no hay sesión.

### Corrección posterior: el enlace dura una hora, no quince minutos

Pregunta del usuario: si el correo llega hoy y el huésped quiere mirar mañana,
no puede.

Son dos cosas distintas, y la segunda ya cubría ese caso: **el enlace** es la
llave (un solo uso) y **la sesión** es estar dentro (7 días). Quien entra hoy
sigue dentro mañana sin pedir nada.

Pero quince minutos era corto para el caso que sí rompe, que no es "mañana"
sino "pedí el enlace y me interrumpieron". Sube a una hora, que es lo que usan
Slack, Notion y Substack. Un enlace que no caducara nunca convertiría cualquier
bandeja de entrada —una cuenta familiar compartida, un correo reenviado— en una
llave permanente que el huésped ni sabe que existe.

Actualizadas las cinco traducciones del correo y las de la web: una copia que
dice "15 minutos" cuando el sistema da sesenta es peor que no decir nada.

```
enlace recién emitido → vence en 60 minutos
cookie de sesión      → caduca en 7 días
```

---

## 39. La política de cancelación estaba inventada

Al preguntar el usuario por los términos que debe ver el huésped, salió esto:
el sitio llevaba tiempo prometiendo una política de cancelación que **no
existía en ningún dato suyo**.

Tres archivos con `subDays(checkIn, 5)` a fuego, y el checkout llegando a
decir:

> _"Cancela antes del X para un reembolso parcial. Después, cancela antes del
> check-in para obtener un reembolso del 50 %, menos la tarifa de servicio."_

Ni `docs/domain-decisions.md` ni `datos.json` contienen una política de
cancelación. Ese 5 y ese 50 % no salían de ninguna parte.

Es peor que un precio inventado: un huésped puede apoyarse en eso en una
disputa, y la anfitriona tendría que sostener una promesa que nadie escribió.

### Lo que se hizo

El usuario pidió "lo mismo que Airbnb". Airbnb no tiene una política, tiene un
menú, así que se implementaron las cuatro como enum en `Property`, editable, y
se eligió **MODERATE** por una razón concreta: el sitio ya venía diciendo
"cancelación gratuita antes de [5 días antes]", y es la única opción que no
contradice lo que ya se le mostró a la gente.

`packages/shared/src/cancellation.ts` guarda **solo las reglas** — los días, no
la prosa. La redacción vive en las traducciones, así que la misma política se
lee natural en cinco idiomas en vez de en uno traducido mal. El PDF duplica el
texto en dos idiomas porque no tiene capa de traducción a la que asomarse.

Dos advertencias que van escritas en la propia pantalla: en una reserva directa
**el reembolso lo procesa la anfitriona**, no hay plataforma que lo arbitre; y
el reembolso automático sigue siendo Fase 7.

### El desglose ahora se guarda

`Booking` gana siete columnas: noches, descuento, extras, huésped adicional,
limpieza, servicio e impuestos.

**Un recibo tiene que decir lo que se cobró.** Recalcular el desglose al
mostrarlo enseñaría los precios de hoy sobre una estadía comprada la temporada
pasada — un recibo que cambia no es un recibo. Se congela al reservar.

### "Esperando el pago" dejó de ser un callejón

Un hold vivo mostraba "esperando el pago" sin forma de pagar. Ahora la reserva
guarda su `checkoutUrl` mientras el hold dura, y el botón devuelve a la misma
sesión de Stripe. Se limpia al confirmar: una sesión ya pagada no es un enlace
que se le dé a nadie.

Y cuando el pago no llega, `checkout.session.expired` ya no solo libera las
fechas — **se lo dice al huésped**, con un enlace para reintentarlo. Callarse
deja a alguien que llegó a la mitad del checkout creyendo que tiene una
reserva.

### Lo que ve el huésped ahora

En la web y en el PDF, todo de fuentes reales: desglose línea a línea, política
de cancelación, dirección, día de basura y las reglas de la casa que la
anfitriona escribió en el CMS. **Los bloques sin nada detrás no se dibujan** —
un encabezado "Reglas de la casa" sobre una caja vacía es peor que ningún
encabezado.

`Property.accessNotes` queda para lo que hace falta y nadie pregunta (dónde
aparcar, cómo funciona la puerta). **Vacío hasta que la anfitriona lo escriba:**
no se inventa un código de puerta.

### Correos con plantilla

`renderEmail` es el sobre de todos los envíos: logo, cabecera crema, botón de
marca. Tablas y estilos en línea, no flexbox — Outlook sigue renderizando con
el motor de Word y Gmail borra los bloques `<style>`. El logo es una URL
absoluta: los adjuntos aparecen como clip en un mensaje que no lo tiene, y
Gmail rechaza los `data:` en imágenes.

### Detalles que se vieron al abrir el PDF

- Las fechas salían en ISO. `31 de julio de 2026` en vez de `2026-07-31`; un
  recibo lleno de números con guiones se lee como un volcado de base de datos.
- Los días de basura salían como `wednesday, saturday`, las claves crudas.
  Ahora se escriben en el idioma del documento.

### Verificación

```
desglose en la reserva     → noches $900 · limpieza $120 · servicio $122 · impuestos $103 · total $1245
política                   → MODERATE, "antes del 26 de julio de 2026"
reglas de la casa          → 183 caracteres, del CMS
día de basura              → miércoles, sábado
terminar el pago           → ausente en una reserva ya pagada
un pago no completado      → libera las fechas y avisa al huésped, con enlace
un hold ya confirmado      → releaseHold no lo toca
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (235 tests, 2 nuevos)
```

### Pendiente del usuario

- **Escribir `accessNotes`** desde el panel, o decirme que lo quite.
- **Confirmar que MODERATE es la política que quiere.** Es un campo editable;
  cambiarla es un `PATCH`, no un despliegue.

---

## 40. La confirmación enseña lo mismo que el área del huésped

La página de confirmación describía la reserva con su propio tipo, más pobre
que el del área del huésped: sin desglose, sin política, sin las condiciones.
Dos descripciones de lo mismo se separan, y ya se estaban separando.

`findBySession` devuelve ahora **la misma forma** que usa el área del huésped,
más el nombre y el correo. Lo que ve alguien que acaba de pagar es exactamente
lo que verá cuando entre el mes que viene.

### El PDF, sin tener que entrar

`GET /bookings/session/:sessionId/pdf`, público por el mismo motivo que la
consulta: el id de sesión de Stripe no llega a nadie salvo a quien pagó, porque
viaja en su URL de vuelta. Pedirle que solicite un enlace por correo para poder
guardarse el recibo del pago que hizo hace treinta segundos sería absurdo.

Un id inventado responde 404.

### Los formularios del checkout

Cuatro campos con `rounded-lg border-input` por defecto: más apretados que el
resto del sitio y con un foco distinto al de las demás pantallas. Ahora
comparten altura, radio y anillo de foco con el formulario de contacto y el
del área del huésped.

Tres cosas más que faltaban y se notan al rellenarlo en un móvil:

- **`autoComplete` en nombre, apellido, correo y teléfono.** Sin ellos el
  navegador no ofrece nada y hay que teclearlo todo.
- **El teléfono no decía para qué se pide.** El correo sí lo decía. Un campo
  que no explica por qué lo necesitas es un campo que se rellena mal o no se
  rellena; ahora dice que es para localizarte el día que llegas.
- **Un campo y una sección pesaban lo mismo** (`space-y-4` en ambos). Los
  campos van ahora a 5 y las secciones respiran.

### Verificación

```
GET /bookings/session/:id       → desglose, política, reglas y basura
GET /bookings/session/:id/pdf   → 200, application/pdf, 27 KB
con un id inventado             → 404
dependencias circulares al arrancar → ninguna
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (235 tests)
```

### Pendientes del usuario, anotados para no perderlos

1. **Rotar `STRIPE_SECRET_KEY`.** Sigue en el historial de un repositorio
   público (§37). Es `sk_test_`, lo que limita mucho el daño, pero hay bots que
   rastrean GitHub buscando exactamente ese patrón.
2. **Escribir `Property.accessNotes`** desde el panel — dónde aparcar, cómo
   funciona la puerta — o decidir que se quite el campo. Está vacío a
   propósito: no se inventa un código de puerta.
3. **Confirmar que MODERATE es la política de cancelación** que quiere. Es un
   campo editable; cambiarla es un `PATCH`, no un despliegue.

---

## 41. Un pago no puede depender de que un webhook llegue

Reserva `AB-C445Q9`: pagada en Stripe, `PENDING` en la base, y la confirmación
diciendo "el pago se procesó, la reserva está tardando". El túnel de Cloudflare
se había renombrado por **tercera vez** y Stripe llevaba reintentando contra un
dominio muerto.

Pedir la URL nueva otra vez habría arreglado el síntoma. En vez de eso se
arregló la clase de problema.

### Reconciliación

`PaymentReconciliationService` pregunta al revés: **qué sesiones dice Stripe
que se pagaron, y cuáles de esas no tienen reserva confirmada aquí**. Corre al
arrancar —el hueco más probable es justo mientras el API no estaba— y cada diez
minutos.

Un webhook es la promesa de que la red de otro alcanzará la tuya, y es una
promesa que se rompe: un túnel se renombra, un despliegue tumba el API cuarenta
segundos, el DNS tiene un mal minuto. Stripe reintenta, pero sus reintentos
también caen sobre lo que estuviera inalcanzable. _Pull_ gana para ponerse al
día; _push_ gana para ser rápido. Los dos juntos son lo que hace que un pago se
convierta en reserva de forma fiable.

Todo lo que encuentra pasa por `confirmPayment`, el mismo camino idempotente
del webhook. Una reserva ya confirmada se deja en paz.

### El hueco que tenía la primera versión

Escrita para mirar solo reservas `PENDING`. Los datos reales enseñaron por qué
no basta: `AB-36PN9X` se pagó, su webhook se perdió, **el hold venció y el
barrido la canceló**. Buscar solo `PENDING` habría dejado fuera exactamente el
caso para el que existe este trabajo — dinero cobrado sin reserva.

Ahora mira `PENDING` y `CANCELLED` con `paidAt` nulo.

### Y funcionó de verdad, con el peor caso

Al ampliarla, la reconciliación encontró `AB-36PN9X` y la cadena entera se
disparó sobre datos reales:

```
Recovering AB-36PN9X: paid on Stripe but no webhook arrived
PAID BUT DOUBLE-BOOKED: AB-36PN9X (cs_test_a13HUi…) — the dates were taken
Email sent to host@areiabela.com: ACCIÓN REQUERIDA · pago sin fechas · AB-36PN9X
Reconciled 1 payment(s) whose webhook never arrived
```

Lo que pasó: `AB-36PN9X` (15–18 ago) se pagó y se perdió; después
`AB-C445Q9` reservó **esas mismas fechas** y sí se confirmó. La restricción de
exclusión se negó a duplicar la reserva, y el aviso de §31 escaló a un humano
con el id de Stripe para el reembolso. Es el peor estado que este sistema
puede alcanzar, y se comportó como se diseñó.

### La política, seleccionable desde el panel

Precios → Reglas de la estadía: las cuatro de Airbnb en un desplegable, y el
campo `accessNotes` junto a ella. Con un aviso que se dice en voz alta porque
es lo que sorprende: **es una reserva directa, el reembolso lo hace la
anfitriona a mano en Stripe.** Nada de esto lo hace solo.

### Verificación

```
AB-C445Q9  → CONFIRMED, pagada 19:35, con sesión
             (Stripe todavía marca su webhook como pendiente de entregar)
AB-36PN9X  → alerta de pago sin fechas, correo enviado
cambiar la política a FIRM     → 200, y la reserva del huésped lo refleja
un valor inventado ("GRATIS")  → 400
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (235 tests)
```

### Consecuencia para el usuario

**El túnel deja de ser crítico.** Un pago cuyo webhook se pierda se recupera
solo en diez minutos como mucho. Sigue siendo mejor tenerlo funcionando —diez
minutos de "confirmando" es una espera fea— pero ya no hay reservas que se
queden colgadas para siempre.

`AB-36PN9X` es un pago real de $1245 sobre fechas que ahora son de otra
reserva. Son cuentas de prueba, pero **el reembolso hay que hacerlo en Stripe**
si se quiere dejar la cuenta limpia.

---

## 42. El desglose no se estaba guardando

Reportado: los impuestos no salen en el detalle de la reserva.

Primer diagnóstico, equivocado: "son reservas anteriores a la migración, las
columnas tienen `DEFAULT 0`". Cierto para las que ya existían, pero al crear
una reserva nueva para comprobarlo, la cotización devolvía $195 de impuestos y
**la fila guardaba 0**.

La causa: el bloque que añade el desglose a `booking.create` nunca llegó al
archivo. El script que lo escribía falló en una sustitución posterior y no
guardó nada; se corrigió la parte que había fallado y se dio por hecho que el
resto había entrado. No se comprobó contra el archivo.

Ahora se escribe y **se verifica leyendo el archivo de vuelta**, no confiando
en que el script no lanzara error.

### El relleno que también estaba mal

Para recuperar el desglose de las reservas anteriores se escribió un `UPDATE`
que calculaba servicio e impuestos sobre `noches + limpieza`. Daba **$30 de más
en todas**, independientemente de las noches.

La razón está en `computeQuote`:

```ts
const accommodation = subtotal - weeklyDiscount + additionalGuestFee
const serviceFee = Math.round(accommodation * (pricing.serviceFeePercent / 100))
const taxes = Math.round(accommodation * (pricing.taxesPercent / 100))
```

**Los porcentajes se aplican solo al alojamiento, no a la limpieza.** 12 % + 13 %
de $120 son exactamente esos $30.

El relleno se rehízo con la base correcta y **cada fila se comprobó contra su
total guardado**; cualquiera que no cuadrara volvía a cero. Todas cuadraron.
Rellenar un recibo con cifras que no suman lo cobrado es peor que dejarlo sin
desglose.

### Una guarda, para que no vuelva a pasar en silencio

La web y el PDF suman las líneas y las comparan con el total. Si no cuadran,
**se muestra solo el total**. Un desglose de "$0 + $0 + $0 = $1.245" haría que
un huésped dude del cargo en vez de entenderlo.

### Y una prueba, que es lo que faltaba

`compute-quote.spec.ts` fija ahora la base imponible: los porcentajes se
calculan sobre el alojamiento, después del descuento, sin la limpieza. Nada en
el código lo decía, y por eso se pudo escribir un relleno contra la suposición
contraria.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (237 tests, 2 nuevos)
```

---

## 43. Limpieza y servicio, opcionales

Pedido a partir de una captura de Airbnb donde el detalle del precio son dos
líneas: noches e impuestos. Nada más.

`cleaningFee` y `serviceFeePercent` ya estaban en `UpdatePropertyDto` —
guardables por API— pero **no había dónde editarlos**: la pantalla de precios
los mostraba de solo lectura. Ahora están en Reglas de la estadía, junto al
porcentaje de impuestos.

Poner cualquiera en cero lo hace desaparecer de la cuenta del huésped. El
desglose de la reserva ya omitía las líneas en cero; **el cotizador público no**,
y mostraba "Tarifa de limpieza $0". Una línea que dice cero es un cargo que el
huésped tiene que leer y descartar.

Con las dos en cero, el desglose queda exactamente como la captura:

```
3 noches          $900
Impuestos         $117
TOTAL            $1017
```

El campo de impuestos lleva su explicación al lado: 6 % estatal, 1 % del
condado y 6 % de turismo, y que los recauda aquí pero los declara ella.

### Fase 7.5 en el plan — módulo de impuestos

Añadida a `docs/migration-plan.md` con alcance y criterio de salida: desglose
por jurisdicción con tasas vigentes por fecha, informe por periodo exportable,
marcar un periodo como declarado, y excluir canceladas y reembolsos.

Queda anotada una decisión que **no se toma sin un contador**: si la tarifa de
limpieza entra en la base imponible. Hoy los porcentajes se aplican solo al
alojamiento (§42). En Florida la limpieza de un alquiler de corta estancia
suele contar como parte de la contraprestación; si entra, son $15,60 por
reserva que ahora mismo no se están cobrando.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (237 tests)
```

---

## 44. El descuento que se mostraba sin descontar

Reportado: el descuento semanal aparece con dos o tres noches, y la cifra no se
está descontando.

Las dos mitades del problema son distintas, y la segunda explica la primera.

### El motor estaba bien

```
2 noches → $0     6 noches → $0
3 noches → $0     7 noches → $210
```

Aplica desde `weeklyDiscountNights`, que es 7. Nunca antes.

### La pantalla mostraba otra cosa

```ts
const hasDiscount = quote.originalPricePerNight > quote.pricePerNight
const savings = (quote.originalPricePerNight - quote.pricePerNight) * quote.nights
```

`originalPricePerNight` **no viene del API**: `fetchQuote` lo inyectaba desde
`datos.json`, un precio "antes" de marketing sin ninguna relación con el
descuento por estadía larga. De ahí las dos cosas que se veían:

- La línea aparecía **con cualquier número de noches**, porque ese precio de
  marketing siempre es mayor que la tarifa actual.
- El importe era `(antes − ahora) × noches`, **una cifra que nadie cobra**,
  mientras `quote.weeklyDiscount` —el descuento real del servidor— estaba en el
  mismo objeto sin usar.

Ahora la tarjeta lee `quote.weeklyDiscount` y solo dibuja la línea si es mayor
que cero. `originalPricePerNight` se elimina del tipo y de `fetchQuote`: era la
única cosa en el flujo de precios que el navegador se inventaba.

### El porcentaje, una lista

Era un campo numérico libre. Pasa a 0 / 5 / 10 / 15 / 20 %, con "Sin descuento
por estadía larga" como primera opción. Un descuento es una decisión comercial
con un puñado de valores sensatos, y un campo de texto invita a un 7,5 % o a un
dedazo que cambia todos los precios en silencio.

El umbral de noches se queda editable y ahora explica qué hace: _"el descuento
aparece solo a partir de estas noches"_.

### Pruebas

Seis nuevas fijan el contrato del motor: cero en 1, 2, 3 y 6 noches; $210
exactos en la séptima; y cero cuando el porcentaje se pone a 0. El motor
siempre estuvo bien — lo que faltaba era algo inequívoco que la pantalla
pudiera dibujar.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (243 tests, 6 nuevos)
```

---

## 45. El checkout, reordenado — y un extra que no hacía nada

### "Huésped adicional" era un control muerto

Aparecía en Precios → Extras con su interruptor de activo/inactivo, y **no
cambiaba ni un centavo**: el cargo por huésped extra sale de
`Property.additionalGuestFeePerNight`, no de ese `Extra`. La fila existía en el
seed pero nadie la seleccionaba nunca.

Eliminada del seed y de la base. El cargo sigue exactamente igual, verificado:

```
9 huéspedes → additionalGuestFee $90   (3 noches × $30)
8 huéspedes → additionalGuestFee $0
```

Ninguna reserva la tenía contratada, así que no hubo nada que preservar. La
cabecera del seed explica ahora por qué no debe volver: dos sitios donde parece
configurarse lo mismo es de donde salen los errores.

### El checkout

La propiedad, las fechas, el grupo y el dinero estaban en **cuatro bloques
separados por la columna izquierda**, por encima y por debajo de los
formularios. Para cuando alguien llegaba al botón de pagar, lo que estaba
pagando había desaparecido de la pantalla.

`CheckoutSummary` los junta en una sola tarjeta fija a la derecha, siguiendo el
orden de las capturas de Airbnb que envió el usuario: foto y valoración,
cancelación con enlace a la política completa, fechas y huéspedes con
**Modificar**, y el detalle del precio con el total.

"Modificar" devuelve al cotizador **con esas fechas ya cargadas**, para que
cambiar la reserva no signifique empezar de cero.

La izquierda se queda con lo que es acción: mensaje a la anfitriona, extras,
datos del huésped, condiciones y el botón.

El detalle del precio dibuja solo lo que se cobra de verdad. Con la limpieza y
el servicio en cero (§43), quedan dos líneas y el total, como en la captura.

### Lo que no se copió de Airbnb, y por qué

La sección **"Forma de pago" con tarjetas guardadas** no se replica. Airbnb
tiene la tarjeta del huésped porque el huésped tiene cuenta con Airbnb; aquí el
pago ocurre en la página alojada de Stripe y **este sitio nunca ve una
tarjeta**. Dibujar una lista de tarjetas sería anunciar una capacidad que no
existe — el mismo motivo por el que se quitaron los logos de Visa y Mastercard
en §38.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (243 tests)
```

### Diferido

- **El enlace "Política completa" apunta a `/#faqs`.** Hay una sección de
  preguntas frecuentes, pero no una página de política de cancelación como tal.
  Cuando exista, es cambiar el destino.

---

## 46. El modal de pago, y bloquear la página mientras Stripe responde

Pedido a partir del modal "Forma de pago" de Airbnb.

### Lo que se hizo igual

Un diálogo antes de salir a Stripe: qué se va a cobrar, quién lo procesa, y un
botón para continuar. El pago sigue ocurriendo en la página alojada de Stripe y
la vuelta es a `/confirmation`, que ya sabía esperar al webhook.

Verificado de punta a punta:

```
1. reserva las fechas      → AB-UCD3H4
2. devuelve la URL         → checkout.stripe.com/c/pay/cs_test_…
3. Stripe acepta la sesión → open · $1017.00
4. al pagar vuelve a       → /confirmation?session_id={CHECKOUT_SESSION_ID}
```

### Lo que no se copió, y por qué

**La lista de tarjetas guardadas.** Airbnb puede mostrarlas porque el huésped
tiene cuenta con Airbnb; aquí la tarjeta se introduce en Stripe y este sitio
nunca ve una. Dibujar "VISA 3043" sería inventar un dato.

**Los trece métodos que la cuenta tiene habilitados.** Se consultaron:
`bancontact` (Bélgica), `blik` (Polonia), `eps` (Austria), `kakao_pay`,
`naver_pay`, `payco` (Corea), `pix` (Brasil)… Stripe solo ofrece los
compatibles con la moneda y el país de quien paga, y para un cobro en USD la
sesión real devuelve `card, link, amazon_pay`. Listar los trece habría sido
prometer métodos que nunca aparecen.

El modal nombra la tarjeta —cierta siempre— y dice de las carteras lo que se
puede decir con verdad: _"Apple Pay, Google Pay y Link aparecen en la página de
Stripe si tu dispositivo los admite."_ Es una promesa hecha en nombre de otro,
así que va condicionada.

### El bloqueo

`PaymentOverlay` cubre la página entera mientras se reserva y se pide la
sesión. No es decoración: son dos llamadas de red y el formulario de debajo
sigue siendo editable — cambiar un nombre con las fechas ya reservadas dejaría
la reserva y la pantalla contando cosas distintas.

Si algo falla, el modal se cierra para que el aviso se vea en la página, en vez
de quedar detrás de un diálogo.

### De paso

Las tarifas de limpieza y servicio se habían quedado en cero de una prueba
anterior de esta misma sesión. Restauradas a $120 y 12 %, verificado que el
total vuelve a ser $1245 para tres noches.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (243 tests)
```

---

## 47. Los datos del huésped, dentro del modal

Aclaración del usuario tras un malentendido: el formulario que quería en el
modal no era el de la tarjeta, sino **el suyo** — nombre, apellido, correo,
teléfono y país. Stripe sigue en su propia página, como estaba.

### Lo que se intentó y se revirtió

Se llegó a implementar Checkout embebido (`ui_mode: 'embedded'`) para dibujar
el formulario de tarjeta dentro del sitio. Revertido entero: los cuatro
archivos del backend y del cliente vuelven a la versión commiteada, y
`@stripe/stripe-js` y `@stripe/react-stripe-js` se desinstalan.

De paso salió que **`stripe` seguía instalado en `apps/web`** desde que el
route handler vivía ahí. Nadie lo importaba desde §37. Fuera también.

La clave publicable vuelve a no existir en el frontend.

### Lo que sí se hizo

`PaymentMethodDialog` recoge ahora los datos del huésped: los cinco campos con
`autoComplete`, la explicación de para qué se pide cada uno, el método de pago,
el total y el botón que lleva a Stripe.

Los datos vivían a mitad de la página del checkout, entre los extras y las
condiciones, así que el botón de pagar estaba lejos de aquello sobre lo que
actuaba. Ahora cada decisión está en el mismo sitio.

El botón del diálogo es el `submit` de su formulario, de modo que el navegador
comprueba los campos obligatorios y enfoca el primero vacío antes de enviar
nada — el mismo mecanismo de §30, que allí faltaba porque el botón estaba fuera
del formulario.

### Verificación

```
hold → AB-JTFWMW · $1245 · redirige a checkout.stripe.com ✓
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (243 tests)
```

---

## 48. El webhook sale del camino crítico

Cuarta vez que el túnel de Cloudflare se renombra y un pago vuelve con 404. La
reconciliación de §41 lo recupera, pero tarda hasta diez minutos — y el huésped
está mirando la pantalla **ahora**.

### El arreglo

`GET /bookings/session/:id` ya no se limita a buscar en la base. Si no
encuentra nada con ese id de sesión, **le pregunta a Stripe**: si la sesión está
pagada y lleva un `bookingId` en su metadata, confirma la reserva ahí mismo y
devuelve el resultado.

El id de sesión llega en la URL de vuelta del propio huésped, así que tenerlo es
prueba suficiente para consultarlo. Y como pasa por `confirmPayment`, hereda su
idempotencia y su manejo del caso "pagado pero las fechas ya son de otro".

Los tres caminos quedan así, del más rápido al más lento:

|                         | Cuándo actúa                             |
| ----------------------- | ---------------------------------------- |
| Webhook                 | segundos, si la red coopera              |
| **Al volver de Stripe** | inmediato, mientras el huésped espera    |
| Reconciliación          | cada 10 min, para quien cerró la pestaña |

Ninguno depende de los otros. El túnel deja de importar para la experiencia del
huésped: aunque no entregue nunca, la reserva se confirma en cuanto vuelve.

### Verificación

Con la reserva reseteada a `PENDING` a propósito y el endpoint del webhook
muerto:

```
GET /bookings/session/cs_test_a1bqnp… → 200 · AB-D7AVTF · CONFIRMED · $1245
log: "Confirming cs_test_a1bqnp… on return: no webhook had arrived"
```

Dos pruebas nuevas: confirma cuando Stripe dice que se pagó, y **no** confirma
cuando dice que no.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (245 tests, 2 nuevos)
```

### Sigue pendiente del usuario

El túnel se ha renombrado cuatro veces en esta sesión. Ya no rompe reservas,
pero mientras el endpoint apunte a un dominio muerto, Stripe acumula reintentos
fallidos. Instalar la CLI de Stripe (`stripe listen`) lo resuelve de raíz; un
_quick tunnel_ sin cuenta no garantiza el nombre.

---

## 49. El cotizador mientras piensa, y el área del huésped que se fundía con el fondo

### El cotizador

Al elegir fechas, la cabecera seguía diciendo "Elige tus fechas" — a alguien que
acaba de elegirlas — y el precio aparecía de golpe sin nada entre medias.

Ahora hay un esqueleto: una barra en la cabecera y las filas del desglose
insinuadas, **sin cifras**. Un esqueleto con números de relleno sería un precio
equivocado en pantalla durante lo que tarde la petición.

Un detalle que casi se cuela: la primera versión mostraba el error cuando
`!isPricing`, y ese estado arranca en `false`, así que el mensaje de fallo
habría parpadeado en el primer render antes de que el efecto llegara a
ejecutarse. Se separa en `priceFailed`, que solo se enciende cuando un intento
terminó sin nada.

### El área del huésped

Reportado: los colores se pierden con el fondo.

La causa, concreta: la cabecera de cada reserva usaba `bg-[#f7f2ea]`, que es
**exactamente `--background`** — el crema de la página. La tarjeta y el fondo
eran el mismo color, y el borde que debía separarlos (`#e2ddd0`) apenas
contrasta contra ese crema.

- La banda de fechas pasa a un tinte azul de marca al 7 %, que separa tanto del
  blanco de la tarjeta como del crema de la página.
- Las tarjetas ganan sombra y un anillo azul tenue, en vez de fiarlo todo a un
  borde de bajo contraste.
- El estado deja de ser un icono de calendario y pasa a distintivo con color —
  verde confirmada, ámbar esperando el pago, gris cancelada — con el color
  repitiendo lo que dice la etiqueta, nunca sustituyéndolo.
- Iconos en azul de marca en lugar de gris sobre gris.
- La referencia gana tamaño: es lo que el huésped viene a buscar.
- La pantalla de acceso y la de datos pasan a tarjeta blanca, en vez de quedar
  sueltas sobre el crema.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (245 tests)
```

---

## 50. Cambiar fechas y huéspedes sin salir del checkout

Pedido: los "Modificar" del resumen deben abrir diálogos, como en Airbnb, en
lugar de devolver al cotizador.

### Extraído, no duplicado

El calendario y el selector de huéspedes ya existían dentro de
`availability-card.tsx`. Copiarlos al checkout habría copiado **las reglas**:
qué noches se deshabilitan, que la salida no es una noche, que los bebés no
cuentan para el aforo, que los adultos nunca bajan de uno. Dos copias de una
regla divergen la primera vez que una cambia.

Salen a tres componentes compartidos:

|                       |                                                               |
| --------------------- | ------------------------------------------------------------- |
| `StayCalendar`        | disponibilidad, mínimo de noches, precios por noche, leyenda  |
| `GuestPicker`         | los cuatro contadores y el aforo                              |
| `ServiceAnimalDialog` | la explicación de que un animal de servicio no es una mascota |

`availability-card.tsx` baja de 655 a 456 líneas y deja de contener lógica que
el checkout también necesitaba.

### Los diálogos

`EditDatesDialog` **carga su propia disponibilidad** al abrirse. El huésped
puede llevar veinte minutos en esta página y la semana a la que se está mudando
puede haberse reservado mientras tanto; usar los datos con los que se pintó la
página sería ofrecerle unas fechas que el servidor rechazaría.

Los dos escriben en la URL, que es de donde se lee la reserva, así que el precio
se recalcula solo. No hay una segunda copia de la estadía que pueda quedar
desincronizada con la que se está cotizando.

`EditGuestsDialog` edita sobre una copia: cerrar con la X deja la reserva como
estaba.

### Un corte que salió mal

El primer intento de extraer el selector de huéspedes buscó el `})}` de cierre
y enganchó el de la definición del array, 250 líneas antes de lo que debía. Se
restauró el archivo desde git y se rehízo verificando el bloque extraído antes
de escribir — el mismo error de §42, donde no comprobar lo que un script había
hecho costó dos diagnósticos equivocados.

```
portada y checkout            → HTTP 200, sin errores de compilación
pnpm build ✅   pnpm lint ✅ (16 avisos, los mismos de antes)
pnpm typecheck ✅   pnpm test ✅ (245 tests)
```

---

## 51. El calendario del huésped, con la paleta del panel

Pedido: que los colores del calendario público coincidan con los del admin —
reservado, día pasado, días futuros, día actual.

### Lo que se alineó

| Estado        | Panel                            | Sitio público                |
| ------------- | -------------------------------- | ---------------------------- |
| Libre         | tinte `secondary`                | el mismo                     |
| Hoy           | `ring-2 ring-ring ring-offset-2` | el mismo                     |
| Ya pasó       | borde punteado, hueco            | el mismo                     |
| No disponible | pizarra                          | pizarra, más tachado y trama |

El día pasado estaba dejado a la opacidad por defecto de react-day-picker y no
aparecía en la leyenda; ahora tiene su entrada y su punteado, como en el panel.
La leyenda pasa de tres estados a cuatro.

### Lo que no se puede alinear, y por qué

El panel pinta **verde** una noche reservada y **pizarra** una bloqueada por la
anfitriona. En el sitio público las dos comparten un solo look, y no es una
omisión: `GET /rates` devuelve un único `available` por noche.

```ts
available: !taken.has(date) // reservas y bloqueos, fundidos
```

Separarlos exigiría exponer **por qué** una noche no está libre, y eso le diría
a cualquier visitante qué semanas están vendidas y cuáles cerró la anfitriona.
Es dato de ocupación; un huésped solo necesita saber que esa noche no es suya.

### Comprobado, no supuesto

El día ocupado aplica `bg-transparent` después del tinte de libre. Se verificó
ejecutando `twMerge` sobre las dos listas antes de darlo por bueno — el mismo
tipo de comprobación que en §35, donde una suposición sobre cómo se fusionan
las clases estuvo a punto de dejar el arreglo a medias.

```
clases de un día ocupado → bg-transparent hover:bg-transparent
¿queda el tinte de libre? → no
CSS compilado            → la trama, el punteado y el anillo, presentes
portada y checkout       → HTTP 200
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (245 tests)
```

---

## 52. Calendario: fuera el mes muerto y fuera la leyenda

Tres correcciones sobre §51, vistas en uso.

### El mes anterior ya no se puede mostrar ni alcanzar

El diálogo abría en el mes de **hoy** y dejaba la estadía para el segundo
panel. Con una reserva en agosto eso significaba una rejilla entera de julio
apagada: un mes que nadie puede reservar ocupando la mitad del calendario.

Ahora abre donde está la estadía, y la flecha `‹` no puede retroceder más allá
del mes en curso:

```tsx
startMonth={startOfMonth(today)}
defaultMonth={value.from && value.from > today ? startOfMonth(value.from) : undefined}
```

`startMonth` hacía falta además de `defaultMonth`: sin él la flecha seguía
llevando a julio aunque el calendario abriera en agosto.

### La leyenda se va

Con un estado menos que explicar y un diálogo que ya venía justo de alto, la
fila de muestras salió. Las cinco claves (`legendFree`, `legendToday`,
`legendSelected`, `legendTaken`, `legendPast`) se eliminaron de los cinco
idiomas en vez de dejarlas huérfanas en `i18n.ts`.

Los estados no quedan sin explicar: el día no disponible conserva el tachado
y la trama, que ya decían "esto no se vende" sin depender del color.

### El día pasado, gris plano

Estaba con borde punteado y `bg-transparent`, y el `bg-transparent` no se veía:
va en la celda, y el botón encima la tapaba con el tinte de noche libre. Ahora
el gris se pinta en el botón, donde vive el relleno visible.

Un día **pasado y ocupado** sigue tramado. La distinción importa: la trama
dice "alguien lo tiene", y a ayer no lo tiene nadie.

```tsx
past: (date) => date < todayStart && !taken(date) && !blocked(date)
```

### Comprobado

```
twMerge del día pasado → bg-slate-100 gana sobre bg-secondary/30
grep de las claves de leyenda en apps/ y packages/ → 0
portada: sin rastro de "Tu estadía" / "No disponible" / "Ya pasó"
portada y checkout → HTTP 200
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (245 tests)
```

---

## 53. Fase 7.1 — Se podía cancelar una reserva pagada y el dinero se quedaba

El agujero: `cancel()` ponía la reserva en `CANCELLED`, devolvía las noches al
calendario y terminaba con este comentario.

```ts
// Refunds are not automated: money going back out is a decision, not a
// side effect of a click.
```

La primera frase era cierta y la segunda también, pero juntas dejaban al
huésped cobrado mientras el checkout y el PDF le prometían una devolución. El
sistema anunciaba un reembolso que no podía ejecutar.

### Lo que decide, y lo que no

`proposeRefund` **propone**. No mueve dinero. El panel enseña la propuesta
línea por línea y la deja en un campo editable, porque quien sabe si la semana
se puede revender no es una función.

Lo que se guarda es la propuesta **y** lo enviado. La diferencia entre las dos
es el único registro de que alguien tomó una decisión.

### A qué se le aplica la política

| Concepto                              | Qué vuelve                                 |
| ------------------------------------- | ------------------------------------------ |
| Noches, tarifa de servicio, impuestos | Lo que diga la escalera: 100 %, 50 % o 0 % |
| Limpieza                              | Entero, siempre que el huésped no llegue   |
| Extras                                | Enteros, por lo mismo                      |

El impuesto sigue al dinero que se queda la anfitriona: no se debe nada sobre
un importe devuelto, y como `computeQuote` lo calcula sobre el alojamiento,
aplicar la misma tasa a los tres los mantiene coherentes entre sí.

La limpieza es el único punto donde una política del 0 % igual devuelve dinero.
Es deliberado y es lo que hace Airbnb: nadie limpió la casa. Una vez que la
estadía empezó no vuelve nada — la casa sí se preparó para alguien que vino.

### Por qué una tabla y no una columna

`Refund` es entidad nueva, y CLAUDE.md pide justificarla. Un `refundedTotal`
en `Booking` respondería "cuánto" y nada más. Hace falta además: excluir
reembolsos de la base imponible en Fase 7.5 y saber **cuándo** ocurrieron,
mostrar **quién** autorizó cada uno, y permitir dos sobre la misma reserva —
uno parcial ahora y el resto tras una conversación. Nada de eso cabe en un
acumulado.

### El orden importa

La fila se escribe **antes** de llamar a Stripe, y su `id` es la clave de
idempotencia. Un reintento que llegue dos veces a Stripe lo rechaza Stripe, no
se paga dos veces. Si Stripe se niega, la fila queda en `FAILED` con el motivo:
un reembolso rechazado es algo que la anfitriona tiene que ver, no que borrar.

Al huésped se le avisa **solo** cuando el dinero ya salió. Anunciar uno que
luego falló sería peor que callarse.

### Lo demás

- `Booking.stripePaymentIntentId`: Stripe reembolsa un PaymentIntent, no una
  sesión. Se guarda al confirmar. Las reservas anteriores no lo tienen, así que
  se busca una vez por su sesión y se guarda — ruta que las 8 reservas pagadas
  de la base van a usar.
- Reembolsar no exige cancelar, y cancelar ofrece reembolsar acto seguido: es
  una decisión en dos pasos, no dos recados.
- El botón aparece aunque la reserva ya esté cancelada. Es justamente el caso
  que más lo necesita: una estadía anulada con el dinero todavía cobrado.

### Comprobado sobre las 8 reservas pagadas reales

```
Política vigente: MODERATE
AB-JJYK9R  llegada 2026-07-31  pagó $1245  -> STAY_STARTED (-1d)  propone $0
AB-T45RMB  llegada 2026-08-06  pagó $1245  -> FULL (5d)   propone $1245
AB-E37EEZ  llegada 2026-08-09  pagó $2370  -> FULL (8d)   propone $2370
AB-UJHWKH  llegada 2026-08-27  pagó $1017  -> FULL (26d)  propone $1017
```

Ninguna propuesta excede lo pagado. `AB-UJHWKH` es la comprobación que más
dice: se reservó con limpieza y servicio apagados desde el panel, y la
propuesta suma 900 + 117 = 1017, exactamente lo cobrado. El desglose cuadra con
el total guardado, no con uno recalculado hoy.

```
GET  /bookings/:id/refund sin sesión → 401
POST /bookings/:id/refund sin sesión → 401
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (269 tests, 24 nuevos)
```

### Pendiente del usuario

Falta **un reembolso real en modo test** desde el panel, de punta a punta. No
lo hice yo: mueve dinero en la cuenta de Stripe del usuario y no tengo su
contraseña de admin para hacerlo por la vía que lo haría ella.

### Diferido

- **Sin `charge.refunded` en el webhook.** Un reembolso hecho desde el panel de
  Stripe no aparece en este libro mayor. El panel propio sí queda al día.
- **Sin reembolso parcial por noche.** Se devuelve un importe, no "las tres
  últimas noches".

---

## 54. Al huésped no le llegaba nada cuando le cancelaban la reserva

Pregunta del usuario, y al ir a mirarlo apareció un hueco más grande que la
pregunta.

### Lo que estaba roto

`cancel()` liberaba las noches, avisaba a la anfitriona y **al huésped no le
decía nada**. Se enteraba al llegar a la casa.

Y el aviso que sí salía estaba mal escrito:

```ts
;`${booking.guestName} canceló su reserva.`
```

Ese método solo se llama desde el panel, así que quien cancela es la
anfitriona. El correo le decía que había cancelado el huésped.

### Lo que se hizo

Un correo al huésped, en sus cinco idiomas, con el motivo si se escribió uno.
No es opcional: los interruptores del panel son sobre cuánto ruido quiere la
anfitriona, no sobre si a alguien se le avisa de que se le canceló el viaje.

Promete el reembolso **solo si hay algo que devolver**. A quien nunca pagó no
se le anuncia dinero de vuelta.

### El plazo: lo que Stripe sabe y lo que no

Pregunta del usuario: cómo saber cuánto tarda en llegarle. Se revisó el SDK
instalado (`stripe@20.4.1`, `types/Refunds.d.ts`) antes de responder.

**No existe ningún campo con fecha estimada de llegada.** Lo que sí hay en
`destination_details.card`:

| Campo              | Qué es                                             |
| ------------------ | -------------------------------------------------- |
| `type`             | `refund`, `reversal` o `pending`                   |
| `reference`        | el ARN, con el que el banco del huésped lo rastrea |
| `reference_status` | `pending`, `available` o `unavailable`             |

`type` es el dato útil y casi nadie lo mira: si el cargo original **todavía no
se liquidó**, Stripe hace un `reversal` y vuelve en 1–3 días hábiles. Si ya se
liquidó, es un `refund` de verdad y son los 5–10 días de siempre. Dos esperas
muy distintas, y Stripe sabe cuál aplica.

Ahora el correo dice cuál de las dos es, en vez de recitar "5 a 10 días" a todo
el mundo. Y añade el ARN **solo cuando `reference_status` es `available`**: un
número de rastreo que el banco todavía no puede buscar manda al huésped a un
callejón sin salida.

El panel muestra lo mismo en el historial, para que la anfitriona pueda
responder "¿dónde está mi dinero?" sin entrar a Stripe.

### Un `!== null` que era un `Boolean()`

El test nuevo falló, y no por el test: `paid: booking.paidAt !== null` da
`true` cuando el campo viene ausente, porque `undefined !== null`. En una fila
de Prisma real siempre viene, así que en producción no se notaba — pero la
comprobación decía otra cosa de la que quería decir. Se corrigió el código.

### Comprobado renderizando los correos de verdad

```
Hola Jane, tu reserva quedó cancelada.
Motivo: Fuga de agua
Si pagaste, el reembolso se gestiona ahora y te llega un correo aparte...

Hi Jane, your booking has been cancelled.
You were not charged for this booking.          ← sin promesa de reembolso

Como el cargo todavía no se había liquidado, se anula directamente:
suele desaparecer de tu extracto en 1 a 3 días hábiles.        ← reversal

El dinero vuelve al mismo método de pago que usaste... 5 y 10 días hábiles.
Si tu banco no lo encuentra, dale este número de rastreo: 751077...  ← refund
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (272 tests, 3 nuevos)
```

### Diferido

- **Sin `charge.refund.updated` en el webhook.** El ARN llega a veces minutos
  después del reembolso; si en ese momento era `pending`, no se rellena solo.
  Hace falta escuchar ese evento para mantenerlo al día.

---

## 55. Los dos reembolsos reales, y el número de rastreo que faltaba

El usuario hizo dos reembolsos desde el panel y preguntó cómo saber si llegaron
a Stripe. Se comprobó preguntándole a Stripe, no a nuestra base.

```
re_3TzHKKFIUDUBDoC21lntboXT   succeeded   $1245.00   tipo refund
  ARN 3977554206558176 (available)
re_3Tz0qOFIUDUBDoC20KYB5rvi   succeeded   $1245.00   tipo refund
  ARN 7091837703965765 (available)
```

`succeeded` es la palabra: Stripe ya lo mandó al banco del huésped.

### Lo que la comprobación destapó

Los dos ARN estaban **disponibles en Stripe y ausentes en nuestra base**. Al
crear el reembolso Stripe todavía los daba como `pending`, así que la fila
guardó null — y los dos correos al huésped salieron sin número de rastreo.
Estaba declarado como diferido en §54; los datos reales lo convirtieron en algo
que arreglar hoy.

### Se resuelve preguntando, no esperando

La opción obvia era escuchar `charge.refund.updated` en el webhook. Se
descartó por lo aprendido en §41: en este proyecto el webhook **es** el
problema — el túnel se renombró cuatro veces y Stripe reintentaba contra un
dominio muerto. Un dato que solo llega por webhook es un dato que a veces no
llega.

`summaryFor` pregunta por las filas a las que les falta el ARN, y solo por
esas. Silencioso si falla: una referencia desactualizada no vale una pantalla
rota.

### Comprobado sobre los dos reembolsos reales

```
ANTES:     re_3Tz0qO...  ARN: —     re_3TzHKK...  ARN: —
DESPUÉS:   re_3Tz0qO...  ARN: 7091837703965765
           re_3TzHKK...  ARN: 3977554206558176
```

Coinciden exactamente con lo que devolvió la API de Stripe. Y `summaryFor` los
devuelve ya en **esa misma llamada**, no en la siguiente: las filas se mutan en
memoria además de guardarse, para que la anfitriona no tenga que cerrar y
reabrir el diálogo.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (275 tests, 3 nuevos)
```

### Para que el usuario lo mire

`AB-JJYK9R`: la política proponía **$0** (`STAY_STARTED`, la llegada era el 31
de julio) y se devolvieron $1245. La reserva además sigue en `CONFIRMED`, sin
cancelar. Puede ser intencionado —el importe se puede sobrescribir y por eso se
guardan las dos cifras— o puede ser una prueba. El registro conserva la
diferencia; la decisión es del usuario.

---

## 56. Fase 7.2 — Pagos: lo que se cobra no es lo que llega

Pregunta del usuario: si podía tener un módulo de Stripe en el panel con pagos,
reembolsos y transacciones. Antes de diseñarlo se miró qué tiene de verdad la
cuenta, y lo que apareció cambió el diseño entero.

### El hallazgo

La cuenta de Stripe es **española y liquida en EUR**. La casa está en Florida y
cobra en **USD**. Cada reserva pasa por una conversión antes de llegar al banco.

```
cobrado (USD)  liquidado (EUR)  proceso  conversión  neto (EUR)      %
      1245.00          1079.30    34.25       21.59     1023.46   5.17%
      2370.00          2066.53    65.35       41.33     1959.85   5.16%
      1017.00           881.65    28.02       17.63      836.00   5.18%
```

Son **dos** comisiones, no una: la de proceso de Stripe y una de **cambio de
moneda** que suma otro ~2 %. Un panel que sumara `Booking.totalPrice` habría
enseñado 14.592 USD de un periodo en el que el neto real fueron 9.870,62 EUR.

Por eso el módulo lee el **libro de Stripe** (`balance_transactions`), no
nuestras reservas: solo esas filas traen la comisión, el neto y el importe en la
moneda en la que la cuenta liquida de verdad.

### Lo que enseña

- Cobrado y reembolsado en la moneda del huésped (USD).
- Liquidado, comisión de proceso, comisión de cambio y **neto** en EUR.
- Un aviso que nombra la conversión en vez de esconderla dentro de un total de
  "comisiones". Es la que nadie espera.
- Saldo retenido en Stripe y transferencias al banco, con su fecha de llegada.
- Cada movimiento, con la reserva y el huésped cuando se puede emparejar.

### Lo que no se empareja se dice

3 de 13 filas no tienen reserva en este sistema. No se ocultan ni se inventa un
nombre: se cuentan y se nombran. Dinero cobrado sin reserva detrás es
exactamente lo que hay que ver, no lo que hay que maquillar.

### Un relleno que hacía falta

Al principio solo emparejaban 4 de 13: las reservas anteriores a Fase 7 no
guardaban `stripePaymentIntentId`, que es la única llave entre el libro de
Stripe y nuestras reservas. Se rellenan solas al arrancar el API, una vez y sin
repetir trabajo — la consulta solo encuentra las que aún lo tienen vacío.

```
antes:   reservas pagadas 8   con PaymentIntent 2
después: reservas pagadas 8   con PaymentIntent 8
filas emparejadas: 4 → 10 de 13
```

### Comprobado contra la cuenta real

```
cobrado a huéspedes  14592.00 USD
reembolsado           2490.00 USD
liquidado            12686.45 EUR
reembolsos           -2158.62
comisión de proceso   -403.48
comisión de cambio    -253.73
= NETO                9870.62 EUR

comprobación (liquidado − reembolsos − comisiones): 9870.62  CUADRA
```

```
/admin/payments sin sesión → 307 a /admin/login
GET /payments sin sesión   → 401
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (275 tests)
```

Los avisos de lint pasan de 16 a 17: es el mismo `set-state-in-effect` que
tienen todas las pantallas del panel que cargan datos (`reservations/page.tsx:83`
es idéntico). Una página más, no un problema nuevo.

### Para que el usuario lo decida

Ese ~2 % de conversión es evitable: se paga por cobrar en USD y liquidar en EUR.
Las salidas son cobrar en euros —que cambia el precio que ve el huésped— o
pedirle a Stripe una cuenta bancaria en dólares. Ninguna se toca sin que el
usuario lo decida: son 253,73 EUR en el periodo mirado.

### Diferido

- **Sin exportar a CSV.** Fase 7.5 lo necesita para el contador; aquí no se
  adelantó.
- **Sin disputas ni contracargos.** Stripe los expone aparte y todavía no hay
  ninguno en la cuenta, así que no se construyó a ciegas.

---

## 57. La cuenta de Stripe pasó a EE. UU. y a dólares

El usuario cambió la cuenta tras leer §56. Confirmado contra la API:

```
país: US    moneda por defecto: usd    (antes: ES / eur)
```

El cambio destapó **dos fallos propios** en el módulo recién escrito, ninguno
visible mientras hubo una sola moneda.

### 1. La moneda de liquidación salía del saldo

```ts
const settlementCurrency = balance?.available[0]?.currency ?? 'eur'
```

El saldo todavía tiene 9.394,22 EUR de antes del cambio, así que esa línea
seguía diciendo **EUR** para una cuenta que ya liquida en **USD**. Ahora se lee
de la cuenta, que es la única autoridad sobre lo que liquida:

```ts
const settlementCurrency = account?.defaultCurrency ?? 'usd'
```

### 2. Los totales sumaban monedas distintas

Había un único bloque de totales. Con el histórico en EUR y todo lo nuevo
llegando en USD, ese bloque habría sumado euros con dólares y devuelto un
número sin significado.

Ahora se agrupan **por moneda de liquidación**: un bloque por cada una, cada
fila lleva la suya, y el panel avisa cuando el periodo cruza un cambio en vez de
apilar dos columnas de cifras que parecen sumables.

Se aprovechó para contar `payment` junto a `charge` — Stripe usa ese tipo para
métodos que no son tarjeta, y es dinero igual. Había una fila así en el libro y
no se estaba contando.

### Comprobado tras el cambio

```
cuenta: país US   liquida AHORA en USD
hubo conversión: true

── bloque EUR  (HISTÓRICO)
   cobrado      14592.00 USD
   liquidado    12686.45
   - conversión   253.73   (convierte: true)
   = NETO        9870.62 EUR      comprobación 9870.62  CUADRA
```

El bloque histórico se marca como tal porque su moneda ya no es la de la
cuenta. Cuando entre el primer cobro nuevo aparecerá un segundo bloque en USD,
esta vez sin línea de conversión.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (275 tests)
```

### Lo que el usuario debería saber

- **Los cobros nuevos ya no pagan conversión.** Se cobra en USD y la cuenta
  liquida en USD. Era ~2 % por reserva.
- **Los 9.394,22 EUR disponibles y 8.832,98 pendientes siguen en euros.** El
  cambio no reconvierte lo que ya está dentro; ese saldo saldrá como euros.
- **Las transferencias son diarias con 2 días de retraso**, según la cuenta.
- No se pudo leer la cuenta bancaria de destino: la clave `sk_test_` no tiene
  permiso sobre `external_accounts`. Conviene confirmar en el dashboard que hay
  una cuenta en USD, o el saldo en dólares se quedará sin salida.

---

## 58. Pagos: quién pagó, con qué tarjeta, y qué se puede perder

Dos peticiones del usuario, y un fallo propio encontrado por el camino.

### El fallo: 39 procesos y una base sin conexiones

La pantalla reventaba en `report.totals.map is not a function`. La causa no
estaba en el código: quien respondía en `:3001` era un API **de ayer** con el
código anterior, donde `totals` todavía era un objeto. El proceso nuevo había
muerto al arrancar con `P2037 — Too many database connections opened`.

Se habían acumulado **39 procesos** `main.ts` a lo largo de dos días, cada uno
con su conexión a Postgres abierta. Todos parados, uno levantado. Es el mismo
descuido de §55 con `.next`: dejar corriendo lo que ya no sirve.

### Saldos

Se emparejaban por posición:

```ts
pending: money(balance.pending[index]?.amount ?? 0)
```

Stripe no promete que `available` y `pending` vengan en el mismo orden. Con dos
monedas en la cuenta, un disponible en EUR podía quedar junto a un pendiente en
USD: un saldo que se lee perfectamente y es falso. Ahora se emparejan por
moneda, y cada una es un bloque en vez de dos listas.

### Clientes

Petición del usuario: que los clientes vivan dentro de Pagos, por ser dato solo
de Stripe.

Al mirarlo apareció el motivo por el que una lista de clientes habría salido
vacía: **ningún cobro estaba asociado a un cliente de Stripe**. Había 2 fichas,
creadas a mano en marzo, sin un solo pago detrás. El checkout mandaba
`customer_email`, que le da a Stripe el correo y no crea nada.

Dos arreglos:

1. `customer_creation: 'always'` en la sesión de checkout, para que los pagos
   nuevos sí queden asociados.
2. La lista se construye **agrupando los cobros por el correo de la tarjeta**,
   que es la única forma honesta de responder "quién nos ha pagado" cuando el
   histórico quedó suelto.

```
quien pagó: 5   fichas de cliente sin cobros: 1

test1@yopmail.com       4 pagos  6105.00 USD   AB-C445Q9, AB-E37EEZ, AB-T45RMB
egiraldom@outlook.com   4 pagos  4752.00 USD   AB-UJHWKH, AB-D7AVTF, AB-JJYK9R
egiraldom7@gmail.com    1 pago   1245.00 USD   sin reserva en este sistema
```

Cinco personas con cifras reales, en vez de dos fichas vacías.

### Lo que Stripe sabe y nosotros no

Cada fila del libro gana lo que solo trae un cargo: la **tarjeta** (`visa
••4242`), el **recibo oficial** de Stripe como enlace que la anfitriona puede
reenviar, el **correo de quien pagó** —a veces el único nombre en una fila sin
reserva— y el **nivel de riesgo**. El riesgo solo se pinta cuando Stripe lo
marca: una etiqueta "normal" en las trece filas enseña al ojo a ignorarla.

11 de 13 filas traen tarjeta y recibo.

### Contracargos

Sección nueva, encima del libro. Hoy no hay ninguno, pero es el único evento
que se lleva el dinero sin preguntar y tiene **fecha límite**: no responder lo
pierde por defecto. No es una fila para pasar de largo.

Se emparejaban mal en la primera versión: comparaba `row.id` (un `txn_…`) con
el id del cargo (`ch_…`), que nunca coinciden, y el respaldo habría colgado la
disputa de una reserva cualquiera. Ahora la fila lleva su `chargeId`.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (275 tests)
```

### Diferido

- **Las fichas de cliente de Stripe no se listan por sí solas.** Se cuentan las
  que no tienen pago y se explica por qué. Cuando los pagos nuevos empiecen a
  asociarse, esa cuenta debería dejar de crecer.

---

## 59. Un huésped, tres identidades en Stripe

Observación del usuario, y es la buena: en Stripe el mismo correo aparecía
repartido en varias entidades. Para `egiraldom@outlook.com` había **tres**:

```
Invitado "erick"   3 pagos   (mar–abr)
Invitado "eeeee"  15 pagos   (jul)
cus_U91C6nsJ39hp3o          gasto 0,00 US$
```

Y Stripe explica por qué, en su propio panel:

> Se ha creado un usuario invitado para mostrar los pagos que no estaban
> asociados con ninguna cuenta.

### Los "Invitados" no existen

No son objetos de la API. Son una agrupación que el Dashboard inventa para
enseñar pagos huérfanos. No se pueden enlazar con nada porque no hay nada que
enlazar.

### Y el arreglo de §58 habría empeorado esto

`customer_creation: 'always'` crea un cliente **por cada checkout**. Stripe no
deduplica por correo, así que un huésped con tres estadías habría terminado con
tres fichas. Se cambió antes de que llegara a producir ninguna.

### La llave la llevamos nosotros

`Customer.stripeCustomerId`, único, creado en el primer pago del huésped y
reutilizado siempre después. La sesión de checkout recibe `customer: <id>` en
vez de `customer_email`.

```ts
...(request.stripeCustomerId
  ? { customer: request.stripeCustomerId }
  : { customer_email: request.email }),
```

Si Stripe se niega a crear la ficha, la reserva **sigue adelante** sin ella: un
pago no puede fallar porque un registro de agrupación no se pudo crear.

### Emparejar por correo, dicho como lo que es

El panel ahora enseña dos enlaces por pagador, y no los mezcla:

| Enlace                | Cómo                        | Fiabilidad              |
| --------------------- | --------------------------- | ----------------------- |
| Reservas pagadas aquí | por el `PaymentIntent`      | sigue al dinero: seguro |
| Mismo correo que…     | por el correo de la tarjeta | sigue a un texto: no    |

La diferencia importa. Sobre los datos reales, mirando el año entero:

```
egiraldom@outlook.com        7 pagos  8487.00 USD
   por el pago:   AB-UJHWKH, AB-D7AVTF, AB-JJYK9R
   por el correo: pepe grillo · 4 reservas

erick.giraldo@banexcoin.com  1 pago   3120.00 USD
   por el pago:   ninguna reserva
   por el correo: no está en la base          ← un desconocido
```

Un pago sin reserva hecho por alguien que se ha alojado tres veces no es lo
mismo que uno hecho por alguien a quien no conocemos, y hasta ahora los dos se
veían igual.

### Lo que no se puede arreglar

Los 3 pagos de marzo y abril **no tienen reserva en este sistema**, y no es un
fallo de emparejamiento: no hay ninguna reserva pagada antes de julio. Son
anteriores al sistema de reservas.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (278 tests, 3 nuevos)
```

### Pendiente de decidir

Si además se quieren **atar los pagos históricos** a la ficha del huésped, hay
que comprobar primero si Stripe deja cambiarle el `customer` a un PaymentIntent
ya cobrado. No se probó porque hacerlo es modificar datos reales de la cuenta
del usuario. Los pagos nuevos sí quedan atados desde ahora.

---

## 60. Los pagos históricos, atados a su huésped

Autorizado por el usuario para probarlo, y luego para aplicarlo solo a los
huéspedes conocidos.

### Stripe dice que no… y que sí

Cambiarle el cliente a un PaymentIntent ya cobrado está prohibido, y el mensaje
es específico:

```
Some of the parameters you provided (customer) cannot be used when modifying
a PaymentIntent that was created by Checkout.
```

Pero el **Charge** sí lo acepta mientras no tenga uno. Probado sobre un solo
cobro antes de tocar nada más:

```
ch_3TzQ1W…  customer: —  →  cus_U91C6nsJ39hp3o   ACEPTADO
```

### Lo aplicado

Script de una sola vez, no código permanente: cada reserva nueva ya pasa
`customer` al checkout, así que el problema deja de crecer solo. Lo que quedaba
era el montón anterior.

```
egiraldom@outlook.com    6 cobros → pepe grillo                 [ficha ya existía]
egiraldom7@gmail.com     7 cobros → Silvia Andrea Ortiz         [ficha nueva]
test1@yopmail.com        4 cobros → Silvia Andrea Barrios Ortiz [ficha nueva]
sssss@gmail.com          1 cobro  → Silvia Andrea Barrios Ortiz [ficha nueva]
erick_scream@msn.com     1 cobro  → Silvia Andrea Barrios Ortiz [ficha nueva]

SALTADOS: wdss@saa.scom (1), erick.giraldo@banexcoin.com (1)
atados: 19   saltados: 2
```

Se corrió primero **en seco**, y los números coincidieron con lo aplicado. Los
dos saltados no son huéspedes de la base: un pago de alguien a quien no
conocemos se queda suelto, porque eso es lo que es.

Estado final en Stripe: **20 cobros con cliente, 2 sueltos**, y una sola ficha
por huésped.

`ensureCustomer` también aprendió a **reutilizar antes de crear**: busca por
correo en Stripe primero. Sin eso habría duplicado a `egiraldom@outlook.com`,
que ya tenía ficha hecha a mano en marzo.

## 61. Cada huésped, con su historial

Propuesta del usuario, y tenía razón: la pantalla decía "3 estadías · 9 noches ·
$3.507" y ahí se acababa. Para saber **cuáles** había que irse a Reservas y
buscar.

Las filas ya se cargaban en el servidor para calcular esos agregados, así que
enviarlas cuesta un campo más, no una petición más.

Cada estadía muestra referencia, fechas, noches, huéspedes, estado, total y
**lo reembolsado**. Una semana devuelta entera dejaba de verse en cuanto se
sumaba al total.

### Comprobado contra los datos reales

```
pepe grillo <egiraldom@outlook.com>  3 estadías · 9 noches · $3507
   AB-UJHWKH  2026-08-27 → 2026-08-30  3n  $1017  CONFIRMED
   AB-D7AVTF  2026-08-24 → 2026-08-27  3n  $1245  CONFIRMED
   AB-JJYK9R  2026-07-31 → 2026-08-03  3n  $1245  CONFIRMED  −$1245 reembolsado
   suma del historial pagado: $3507  CUADRA
```

Cuadra en los cuatro huéspedes.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (280 tests, 2 nuevos)
```

### Un matiz que queda a la vista, a propósito

`pepe grillo` figura con **$3.507 gastados** y una de esas estadías se devolvió
entera. El agregado dice lo que pagó, no lo que la casa se quedó; el reembolso
aparece en su línea al desplegar. Si se prefiere que el total reste los
reembolsos, es una decisión del usuario y cambia también quién cuenta como
huésped recurrente.

---

## 62. El historial de estadías, legible

El usuario: "se ve muy feo ponerlo de lado". Tenía razón, y el problema era de
jerarquía, no de estilo.

### Lo que estaba mal

Referencia, fechas, noches, huéspedes, estado y precio iban en **una sola fila**
con `flex-wrap`. Seis datos con el mismo peso visual, rompiendo en un punto
distinto en cada tarjeta según lo largo que fuera el nombre del huésped. Nada
alineaba con nada.

### Lo que hace ahora

Cada estadía es un bloque que se lee de arriba abajo:

```
AB-JJYK9R  ● Confirmada                        $1,245
31 jul → 3 ago 2026                              −$1,245
3 noches · 👤 1                                reembolsado
```

- **Qué es** arriba: referencia y estado.
- **Cuándo** en medio, en el tamaño del cuerpo porque es lo que más se busca.
- **Detalle** abajo, en gris pequeño.
- **Cuánto** en su propia columna a la derecha, para que los importes se puedan
  comparar bajando la vista en vez de cazarlos por la fila.

El estado pasa de texto suelto a etiqueta, con **la misma paleta que la pantalla
de Reservas**: una reserva confirmada se ve igual en los dos sitios. El color
repite la palabra, no la sustituye.

Un importe sin pagar va en gris y la estadía lo dice con todas sus letras: un
total en negro junto a una reserva que nadie pagó afirma algo que no es cierto.

```
divide-y, bg-emerald-50 y rounded-[12px] presentes en el CSS compilado
/admin/guests → 307 al login   /es → 200   panics: 0
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (280 tests)
```

---

## 63. El huésped se abre, no se despliega

El usuario preguntó si el historial iba mejor debajo del huésped o en un modal.
Modal, por tres razones que se ven al usarlo:

1. La tarjeta ya llevaba avatar, nombre, dos etiquetas, tres datos de contacto,
   tres cifras y tres botones. Meterle una lista dentro la revienta.
2. Desplegar hacia abajo **empuja al resto de la lista** y el lector pierde
   dónde estaba — justo la persona que acababa de mirar.
3. Con 5 huéspedes se aguanta. Con 50 no.

Una persona es un sujeto que se abre, no una fila que se despliega.

### Lo que gana al abrirse

Sitio para que convivan cosas que antes competían por una línea: contacto con
enlaces a correo y teléfono, las tres cifras en su fila, la **nota privada**
destacada —antes se truncaba con puntos suspensivos en la lista— y el historial
completo. Las acciones quedan fijas abajo, la cabecera fija arriba: en un
huésped con quince estadías el nombre no se va de la pantalla.

### Detalles que no se ven pero se notan

- La tarjeta responde a **Enter y espacio**, no solo al ratón.
- Los botones de la fila **paran la propagación**: sin eso, borrar un huésped lo
  habría abierto además de preguntar si se borra.
- Editar desde el modal lo cierra antes de abrir el formulario, en vez de
  apilar dos diálogos.

Sale a su propio archivo (`guest-detail-dialog.tsx`) en vez de engordar una
página que ya iba por 500 líneas.

```
/admin/guests → 307 al login   /es → 200   panics: 0
advertencias de lint en los archivos tocados: 0
```

```
pnpm build ✅   pnpm lint ✅ (0 errores, 17 avisos — el mismo baseline)
pnpm typecheck ✅   pnpm test ✅ (280 tests)
```

---

## 64. MODERATE confirmada

El usuario confirma que **MODERATE** es la política de cancelación correcta.
Cierra el pendiente abierto en §40.

No hay cambio de código: era ya el valor por defecto del schema y el que tiene
la fila real en la base. Lo que cambia es que deja de ser una suposición
heredada de lo que el sitio venía prometiendo ("cancelación gratuita hasta 5
días antes") y pasa a ser una decisión tomada.

Sigue siendo editable desde el panel; cambiarla es un `PATCH`, no un
despliegue. Lo que se cobra y lo que se devuelve sale de `CANCELLATION_RULES`,
así que cambiarla mueve también lo que propone el diálogo de reembolso.

### Sigue vacío, y sigue siendo del usuario

`Property.accessNotes` — dónde aparcar, cómo funciona la puerta — se escribe en
`/admin/pricing`, en "Reglas de la estadía". Vacío hoy, así que ni el área del
huésped ni el PDF muestran ese bloque (los dos comprueban antes de pintarlo, no
sale un título huérfano). Mientras siga así, esa información la manda la
anfitriona a mano.

Nota de ubicación: el campo vive en **Precios** por estar junto a las reglas de
estadía, pero cómo entrar a la casa no es un precio. Se mueve a Ajustes si el
usuario lo prefiere.

---

## 65. Fase 7.4 — Mínimos de noches por temporada

Estaba declarado como diferido desde §36: _"hoy el mínimo es uno para todo el
año, y lo habitual es exigir más noches en las fechas altas"_.

### Lo que apareció al ir a hacerlo

`PriceRule` **no tenía CRUD**. Ni endpoint, ni pantalla: una temporada alta solo
podía existir sembrando la base de datos. Añadir una columna de mínimo a una
tabla que nadie puede escribir habría sido entregar media función, así que la
fase incluye el alta, edición y borrado de temporadas.

### Quién decide el mínimo

La **fecha de llegada**, no todas las noches que toca la estadía.

Es lo que el huésped ya entiende de reservar en otros sitios, y es la versión
que se puede explicar en un calendario: "llegar esta semana son mínimo siete
noches". Tomar la regla más estricta que la estadía roza significaría que una
reserva de febrero que termina el primer día de temporada alta de pronto exige
una semana, por un motivo invisible al elegir las fechas.

El coste de esa decisión es real y está escrito en el código: quien llega la
noche antes de una semana alta se lleva el mínimo de temporada baja para una
estadía que es casi toda alta.

Una temporada solo puede pedir **más** noches, nunca menos: el mínimo de la casa
es un suelo que ninguna regla baja.

### Guardarraíles, comprobados contra la base real

```
solape rechazado:            These dates overlap "PRUEBA Navidad"
fechas invertidas:           The season ends before it starts
finde con fechas:            A WEEKEND rule has no dates: it is the fallback rate
base protegida:              The base rate cannot be deleted
mínimo limpiado:             null
limpiado: 1 fila de prueba   temporadas antes 1 → después 1
```

El solape importa más de lo que parece: `ruleForNight` toma la primera regla
HIGH que encaja, así que dos rangos superpuestos harían que la misma noche se
cobrara de una forma u otra según el orden en que la base devolviera las filas.
La misma estadía, dos precios, en dos peticiones seguidas.

Las filas de prueba se borraron **por id**, solo las que creó el script.

### Un bug que el tipado destapó

La pantalla iba a cargar las temporadas de `GET /properties/:slug`, que devuelve
el `Decimal` de Prisma como **string** y además esconde las reglas inactivas. El
componente llama a `.toFixed()`. Un `as unknown as` lo habría dejado pasar hasta
producción; ahora se cargan del endpoint propio, que devuelve números.

### Lo que ve el huésped

El cotizador ya sabía decir "esta casa acepta reservas de al menos N noches".
Ahora ese N sale del `quote`, que conoce la temporada de la fecha de llegada, en
vez de la propiedad. El calendario sigue permitiendo el mínimo de la casa y el
precio explica el resto en cuanto se eligen fechas.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (289 tests, 9 nuevos)
```

### Diferido

- **El calendario no pinta el mínimo por fecha.** Muestra el de la casa;
  react-day-picker toma un único `min` para toda la rejilla. El huésped se
  entera al elegir las fechas, no antes.
- **No se puede cambiar el tipo de una temporada** ya creada. Pasar HIGH a
  WEEKEND obligaría a soltar las fechas y podría chocar con la regla de fin de
  semana existente; se borra y se crea.

---

## 66. Fase 7.3 — La reserva que se toma por teléfono

Estaba diferido desde §34: _"no se puede crear una reserva desde el panel. Se
puede añadir al huésped, pero una estadía tomada por teléfono todavía no tiene
por dónde entrar"_.

### El precio sigue siendo del servidor

El formulario manda fechas y huéspedes; **nunca un total**. Se cotiza en vivo
contra el mismo endpoint que usa el cotizador público, porque quien está en la
llamada tiene que decir una cifra en voz alta — y la que dice es la que se
cobra.

```
desglose de AB-ARXMN2: 1356 vs total 1356  CUADRA
```

### Dos formas de cobrar, y ninguna a medias

|                                                     | Estado                       | Vence    |
| --------------------------------------------------- | ---------------------------- | -------- |
| Ya cobrada (efectivo, transferencia, tarjeta, otro) | `CONFIRMED`, `paidAt` puesto | nunca    |
| Enviar enlace de pago                               | `PENDING`                    | 24 horas |

Media hora es lo correcto para alguien que ya está en la página de pago y lo
incorrecto para alguien que acaba de colgar: tiene que buscar el correo, leerlo
y encontrar la tarjeta. Stripe no sostiene una sesión más de 24 horas, así que
ese es el techo, no una preferencia.

El enlace va **al portapapeles** al crearla: la anfitriona está al teléfono y va
a pegarlo en un mensaje, no a dictar una URL.

Solo se le manda confirmación al huésped cuando el dinero ya está. A quien no ha
pagado no se le promete una estadía.

### Los límites se enseñan, no se imponen

Un mínimo de noches existe para que un desconocido no se lleve una sola noche en
Navidad. Quien está al teléfono es la persona que puso ese mínimo, y negarle su
propia excepción sería el software discutiendo con su dueña. El diálogo avisa
—"estas fechas piden mínimo 7 noches"— y deja crear igual.

Lo que **sí** se impone es lo que no es una preferencia: la restricción de
solapamiento y las fechas bloqueadas.

### `Booking.source`

Columna nueva, `WEBSITE` o `PANEL`. Sin ella una reserva cobrada en efectivo
parece dinero que el panel de pagos perdió: ese panel lee el libro de Stripe, y
un billete de cien nunca aparece ahí. La lista de reservas la marca con una
etiqueta.

`paymentMethod` guarda cómo se cobró cuando Stripe no intervino.

### Comprobado contra la base y Stripe reales

```
EN EFECTIVO  AB-ARXMN2  $1356
   estado CONFIRMED  origen PANEL  método CASH
   pagada: sí   vence: nunca   enlace: ninguno

solape rechazado: Those dates are already taken

CON ENLACE   AB-4GGQA8  $1017
   estado PENDING  vence en 24 h
   enlace: https://checkout.stripe.com/c/pay/cs_test_a1a...

limpiado: 2 reservas de prueba y su huésped
```

### Un aviso de lint que se arregló en vez de silenciarse

El diálogo llamaba a `setQuoting(true)` dentro del efecto. En vez de un
`eslint-disable`, "todavía calculando" pasa a ser una comparación: se guarda
para qué fechas es la cotización que hay, y la respuesta se deriva. Misma forma
que en la pantalla de pagos (§56). Los avisos vuelven a 17, el baseline.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (295 tests, 6 nuevos)
```

### Diferido

- **Sin extras en el alta manual.** El formulario manda `extraIds: []`. Una
  cuna o la piscina climatizada se añaden después editando la reserva… que
  tampoco se puede editar todavía.
- **No se puede editar una reserva ya creada.** Corregir una fecha mal tomada
  obliga a cancelar y rehacer.
- **Sin precio negociado.** Un descuento acordado por teléfono no tiene dónde
  ponerse: aplicarlo bien exige decidir si baja también la base imponible, y eso
  toca lo que se declara a Florida. Fase 7.5.

---

## 67. Las tres deudas del panel

### El calendario, a dos meses

Bloquear un rango que cruzaba el cambio de mes —una reparación entre diciembre y
enero, la Navidad de la anfitriona— obligaba a navegar con la selección a medias
confiando en que sobreviviera. Ahora se ven dos meses a la vez.

Un detalle que hacía falta pensar: un día del mes vecino se dibuja para que las
columnas cuadren, pero **no se puede pulsar** en el panel donde no le toca.
Sin eso, hacer clic en el "1 de agosto" que asoma bajo julio habría seleccionado
una fecha que el lector no está mirando. Cada panel lleva su mes escrito encima,
porque con dos rejillas juntas deja de ser obvio cuál es cuál.

Los contadores de noches libres y ocupadas cuentan ahora el rango entero.

### El motivo de un bloqueo, editable

Corregir una errata obligaba a liberar las noches y volver a bloquearlas — lo
que, durante esos segundos, ponía a la venta una semana que la anfitriona había
cerrado. Ahora se edita en el mismo diálogo donde se libera.

Las **fechas siguen sin ser editables**, y es deliberado: mover un bloqueo no es
editarlo, es otro bloqueo, y hay que comprobarlo de nuevo contra las reservas.
Arreglar una errata no debería pagar ese precio.

Un motivo vacío borra el anterior en vez de guardar una cadena en blanco.

### El scroll horizontal del diálogo de fechas

Dos meses a `--cell-size: 3rem` piden unos 700px; el diálogo está topado en
768px menos su relleno. Se salía por poco, y la página entera crecía una barra
horizontal para enseñar un calendario.

Dos arreglos, y ninguno es esconder el desbordamiento:

- **Un mes por debajo de 46rem**, decidido con `useSyncExternalStore` sobre una
  media query en vez de un efecto: el viewport es un sistema externo al que
  React debe suscribirse, y esa es la API. Da además un valor de servidor, así
  que el primer pintado no es una suposición que luego salta.
- **Celda fluida**, `clamp(2.25rem, 7vw, 3rem)`, para que encoja antes de
  empujar.

El `overflow-x-hidden` del diálogo queda como cinturón sobre los tirantes: si un
cambio futuro vuelve a ensancharlo, recorta el diálogo y no la página.

Esto arregla de paso el cotizador público en móvil, donde dos meses a 3rem
tampoco cabían.

## 68. `accessNotes`, con estructura y sin inventos

El usuario pidió llenarlo con datos de ejemplo. Se llenó con una **plantilla de
marcadores**, no con datos.

CLAUDE.md prohíbe inventar valores plausibles, y este campo es el peor sitio
para saltarse esa regla: un código de puerta inventado es uno que un huésped
acaba tecleando de pie frente a la casa. Lo que se escribió es real —**la forma**:
las preguntas que todo huésped hace— con 15 marcadores entre corchetes donde van
las respuestas.

```
- Puerta principal: [cómo se abre — código, caja de llaves, cerradura inteligente]
- Wi-Fi: red [nombre de la red], contraseña [contraseña]
- Escríbele a Angélica al [teléfono de contacto]
```

Así la anfitriona sustituye en vez de decidir qué contar, y nada parece real por
accidente. El script no pisa el campo si ya tiene contenido.

**Sigue siendo del usuario**: mientras queden corchetes, el huésped los ve tal
cual en su reserva y en el PDF.

```
pnpm build ✅   pnpm lint ✅ (0 errores, 17 avisos — baseline)
pnpm typecheck ✅   pnpm test ✅ (295 tests)
```

---

## 69. Fase 7.5 — Impuestos: cuánto se debe y a quién

Desbloqueada por el usuario: la limpieza **no** entra en la base imponible.
Comprobado que ya era así — `computeQuote` aplica los porcentajes a
`subtotal − descuento + huésped extra`, y la limpieza nunca estuvo dentro. No
hubo nada que cambiar en el motor de precios.

### El problema real

Al huésped se le cobra **un** 13 %. Una declaración se presenta por **autoridad**:
Florida DOR se lleva el 6 % estatal y el 1 % del condado, y el Tax Collector de
Pinellas el 6 % de turismo — en calendarios distintos. `Property.taxesPercent`
no puede ser lo que se declara.

`TaxJurisdiction` guarda cada autoridad con su tasa y **sus fechas**, porque un
cambio de tasa no debe reescribir lo ya cobrado: una tasa nueva es una fila
nueva, la vieja se cierra.

`TaxFiling` guarda que un periodo se declaró y se pagó. El informe siempre se
puede recalcular; lo que no se puede deducir es si alguien lo presentó.

Dos entidades nuevas, justificadas como pide CLAUDE.md, y ya previstas en el
plan.

### Un fallo propio que los datos reales destaparon

La primera versión repartía todo con las tasas de **hoy**. Entonces apareció
`AB-JJYK9R`: base 900, impuesto cobrado 103 — un **11,44 %**, no 13 %. Su
factura suma correctamente, así que no es un error: se cobró con otra
configuración y la factura está congelada, como debe estar.

Repartir eso al 6/1/6 de hoy le habría dado a una autoridad una parte de dinero
recaudado bajo otro arreglo. Ahora **cada estadía se reparte con las tasas
vigentes el día en que se cobró**, que es exactamente para lo que la tabla tiene
fechas.

Y la anomalía se enseña en vez de suavizarse: cada estadía muestra su tasa
efectiva, y la que no coincide con la de la casa sale en ámbar.

```
AB-JJYK9R  base   900  impuesto  103  = 11.44%  <-- distinta de la actual
AB-E37EEZ  base  1800  impuesto  234  = 13%
```

### Comprobado contra la base real

```
Impuesto de desarrollo turístico     6%  recaudado 425.54  a declarar 378.00
Impuesto estatal de Florida          6%  recaudado 425.54  a declarar 378.00
Recargo del condado de Pinellas      1%  recaudado  70.92  a declarar  63.00

suma de jurisdicciones: 922.00   total recaudado: 922.00        CUADRA
columnas `taxes` de la base: 922.00                             CUADRA
las tres tasas suman 13%   la casa cobra 13%                    CUADRA
```

El criterio de salida del plan pedía justo eso: que las cifras cuadren con la
suma de las columnas `taxes` de las reservas del periodo.

```
declarado: $378 ref PRUEBA-12345    el informe lo refleja: sí
declarado otra vez: 1 fila (corrige, no duplica)
periodo invertido rechazado
limpiado: 0 declaraciones de prueba
```

### Decisiones que son del contador, dichas en pantalla

Dos, y las dos aparecen bajo el informe en vez de esconderse en el código:

- Una estadía cuenta en el periodo en que se **pagó**, no en el que ocurre.
- Un reembolso reduce la base **en proporción**. Exacto para una devolución
  total, que es lo que han sido las dos reales.

### Si las tasas no suman

Un aviso rojo: si las jurisdicciones no suman lo que se le cobra al huésped,
hay dinero recaudado sin autoridad a la que declararlo. No es un problema de
redondeo y no se muestra como tal.

### El CSV

Resumen por autoridad más una fila por estadía, porque a un contador que recibe
una cifra lo siguiente que pregunta es qué reservas la componen. Lleva BOM para
que Excel no destroce "Jurisdicción".

```
pnpm build ✅   pnpm lint ✅ (0 errores, 18 avisos)
pnpm typecheck ✅   pnpm test ✅ (295 tests)
```

El aviso 18 es el mismo `set-state-in-effect` de toda pantalla del panel que
carga datos (`reservations:95`, `payments:169`). Una página más, no un problema
nuevo.

### Diferido

- **La tasa de una jurisdicción no se edita desde el panel.** Se siembran con
  `pnpm --filter @areia-bela/api seed:taxes`. Cerrar una y abrir otra con fecha
  nueva es lo que exige un cambio de tasa, y esa pantalla no está.
- **Sin recordatorio de vencimiento.** El panel dice cuánto se debe, no cuándo
  vence en cada autoridad.

---

## 70. Cambiar de idioma borraba lo que estabas escribiendo

Reporte del usuario: _"cuando se cambie de idioma se tiene que renderizar la
página?, si cambio pierdo las selecciones que hice"_.

Sí perdía, y la causa no era un remonte. El proveedor de idioma del panel es
estado plano, sin navegación ni `router.refresh()`. El problema estaba doce
capas más abajo, repetido **en trece sitios**:

```ts
const load = useCallback(async () => {
  try {
    const property = await cms.property()
    setStored(property)
    setDraft(property) // ← aquí muere lo que el usuario escribió
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : t.property.loadFailed)
  }
}, [t.property.loadFailed]) // ← una cadena traducida como dependencia

useEffect(() => {
  void load()
}, [load])
```

La dependencia es un **mensaje de error**. Al cambiar de idioma la cadena cambia
de valor, React rehace el callback, el efecto que lo observa se dispara, la
pantalla vuelve a pedir los datos — y en un formulario eso es
`setDraft(stored)`: todo lo tecleado, reemplazado por lo que hay en el servidor,
por elegir otro idioma.

### El arreglo

Un mensaje no es motivo para volver a pedir datos. `useAdminCopyRef()` deja la
copia alcanzable desde dentro de un callback sin participar en su identidad:

```ts
toast.error(err instanceof ApiError ? err.message : copyRef.current.property.loadFailed)
}, [copyRef])   // un ref: el mismo objeto en cada render
```

El ref se asigna en un efecto, no durante el render: mutar un ref mientras se
renderiza no es seguro bajo React concurrente, y un mensaje que va un commit por
detrás es un mensaje que nadie distingue.

```
antes — dep = la cadena:  ¿cambia al cambiar idioma? SÍ → el efecto se relanza
ahora — dep = el ref:     ¿cambia al cambiar idioma? no → el efecto NO se relanza
```

### Los trece

Ajustes de la propiedad, ajustes del sitio, equipo, galería, landing, FAQs,
reseñas, páginas, precios, calendario, huéspedes, y el diálogo de reembolso —
donde además borraba el importe ya tecleado antes de mandarlo a Stripe.

El decimocuarto se deja como está: `maintenance` filtra por nombres de área
traducidos, así que ahí el `useMemo` **debe** depender del idioma. Recalcular un
filtro no pierde nada; rehacer una petición sí.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (295 tests)
```

---

## 71. Paginación en el panel

Pedido del usuario. Un `usePagination` compartido más un control, en vez de
cuatro implementaciones que se irían separando.

### Dónde, y dónde no

| Pantalla  | Se pagina                        |
| --------- | -------------------------------- |
| Reservas  | solo el **pasado**               |
| Huéspedes | la lista, después de la búsqueda |
| Pagos     | el libro de movimientos          |
| Impuestos | las estadías del periodo         |

En Reservas, lo que viene **no** se pagina: es sobre lo que la anfitriona actúa,
y está acotado por lo lejos que se puede reservar una casa. El historial no lo
está.

En Huéspedes se pagina lo ya filtrado. Paginar sobre todo y luego buscar sería
pasar páginas de resultados que no coinciden.

### Es del lado del cliente, y se dice

Los endpoints siguen devolviendo todo. Para una casa eso está bien y no es lo
que dolía: lo que dolía era pintar cuatrocientas tarjetas. Cuando el payload sea
el problema, la solución es un endpoint paginado y este control sigue
funcionando encima.

### Dos cosas que el linter tenía razón en señalar

**Los hooks iban después de un `return` temprano.** Cuatro errores, no avisos, y
con motivo: un hook que se salta en un render y se ejecuta en el siguiente
rompe el orden del que React depende. Subidos por encima de todo `return`, con
la lista de origen tolerando el `null` de mientras carga.

**La página fuera de rango se corregía en un efecto.** Borrar al último huésped
de la página 7 deja esa página vacía; arreglarlo después pinta el vacío y luego
salta. Ahora se recorta durante el render, así que la página vacía no llega a
existir. La página guardada se deja intacta: la lista puede volver a crecer, y
con ella la posición.

```
    0 elementos, pág 1 → 1/1  mostrando 0-0
   21 elementos, pág 2 → 2/2  mostrando 21-21
  140 elementos, pág 7 → 7/7  mostrando 121-140
   19 elementos, pág 7 → 1/1  mostrando 1-19     ← recortada
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (295 tests)
las cinco rutas responden · 0 panics
```

---

## 72. Fechas bloqueadas por un pago que nunca se abrió

Reporte del usuario: al intentar reservar y faltar algo, las fechas quedaban
bloqueadas sin haber pagado.

Se recorrieron los tres caminos:

| Camino                                   | Qué hacía                                        |
| ---------------------------------------- | ------------------------------------------------ |
| Falta un dato del formulario             | 400 antes de escribir nada — **ya era correcto** |
| **Stripe falla al abrir el pago**        | la fila ya estaba escrita → media hora bloqueada |
| **El huésped vuelve atrás desde Stripe** | nada la liberaba → media hora bloqueada          |

### El hueco de Stripe

`hold()` escribe la reserva en una transacción y **después** llama a Stripe,
deliberadamente: una transacción abierta durante una llamada de red sería un
candado sobre el calendario entero mientras Stripe tarde (§29).

Pero eso deja una ventana. Si Stripe se niega —clave mal puesta, red caída, la
configuración de métodos de pago— la fila ya está confirmada y la semana queda
cerrada por una página de pago que nadie llegó a ver.

Un hold se gana sus fechas **cuando hay dónde pagar**. Si no lo hay, se sueltan
en el acto.

Comprobado con un Stripe que siempre falla, contra la base real:

```
antes:  ¿fechas libres? sí
Stripe falló: "Stripe está caído"
después: ¿fechas libres? SÍ — el hold se soltó
la fila quedó: AB-G98835 CANCELLED — "No se pudo abrir el pago"  vence: nunca
```

La fila se conserva cancelada en vez de borrarse: que un pago no se pudiera
abrir es algo que la anfitriona querrá ver si se repite.

### El huésped que se arrepiente

El `cancel_url` de Stripe ahora lleva el id de la reserva, así que en cuanto el
huésped vuelve al checkout la semana sale a la venta otra vez, en lugar de
quedarse cerrada el resto del hold. La URL se limpia después para que un
refresco no lo pida dos veces.

`POST /bookings/:id/abandon` es público porque el huésped no tiene sesión, y es
seguro que lo sea: hace falta el id, solo toca un hold **sin pagar**, y lo peor
que consigue un id adivinado es liberar fechas que la barrida iba a liberar
dentro de la media hora. Va con límite de peticiones para que no sirva de
buscador de ids.

La guarda vive en el `where`, no en un `if`:

```ts
where: { id: bookingId, status: 'PENDING', paidAt: null }
```

Así un hold que se pagó entre medias no lo puede barrer un fallo que llega
tarde.

### Lo que no cambia, y por qué

**Un hold sigue bloqueando las fechas mientras el huésped paga.** No es un
efecto secundario: es lo que impide que dos personas paguen la misma semana, y
es el motivo de la restricción de exclusión de §29. Sin él, el segundo en pagar
descubre que su dinero compró unas fechas que ya no existen — que es
exactamente el peor estado que este sistema tiene (§41).

Lo que se ha arreglado es que las bloquee **solo** mientras hay un pago vivo.

```
POST /bookings/inventado/abandon → 204   (no revela si existe)
/es/checkout?abandoned=... → 200
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (298 tests, 3 nuevos)
```

---

## 73. La plantilla de acceso no llega al huésped hasta estar rellena

El usuario decide dejar `accessNotes` como plantilla y sustituirla más
adelante. Razonable, pero tal cual estaba, **el huésped veía los corchetes**:

```
Puerta principal: [cómo se abre — código, caja de llaves, cerradura inteligente]
Wi-Fi: red [nombre de la red], contraseña [contraseña]
```

Eso es peor que no decir nada. Un bloque vacío se lee como "esto llega por
separado"; uno con corchetes se lee como que la casa se olvidó.

Ahora el API no las expone mientras sigan siendo plantilla — ni en el área del
huésped ni en el PDF, que ya se saltaba los bloques vacíos y por tanto no
imprime ni el título.

### La regla, y su sesgo

Cualquier texto entre corchetes de dos o más caracteres cuenta como marcador.
Es una heurística, y está inclinada a propósito: ocultar unas notas ya
terminadas le cuesta al huésped un correo; enseñarle `[cómo se abre]` le cuesta
una puerta que no puede abrir.

El coste está asumido y pinado en un test: prosa que use corchetes de verdad
—`[sic]`— también lo dispara. Por eso el panel **nombra** lo que encontró en
lugar de limitarse a marcarlo: "faltan 14: [dirección completa…], [dónde
aparcar…]". Marcar manda a buscar; nombrar manda al sitio.

El aviso se recalcula al teclear, así que desaparece con el último corchete.

### Comprobado sobre la propiedad real

```
la plantilla tiene 14 marcadores sin rellenar
lo que ve el huésped hoy: NADA (bloque oculto)
si se rellenaran:          se muestra
```

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (308 tests, 10 nuevos)
```

### Pendientes del usuario, actualizados

- **Rotar `STRIPE_SECRET_KEY`:** el usuario lo hará al pasar a producción, junto
  con el resto de variables. Las actuales son `sk_test_`, que no mueven dinero
  real. Lo que sí importa entonces: la clave `sk_live_` no puede llegar nunca al
  repositorio.
- **Cuenta bancaria en USD:** la cuenta está en `charges_enabled: false` y
  `payouts_enabled: false` — es de test y sin activar, así que esto es una
  pregunta de producción y va con lo anterior. Se configura en
  `dashboard.stripe.com/settings/payouts`. Las transferencias están en diarias
  con 2 días de retraso.
- **`accessNotes`:** se queda como plantilla, ya sin riesgo para el huésped.

---

## 74. Fase 8.1 — CI

Hasta ahora `lint`, `typecheck`, `test` y `build` solo corrían porque alguien
los lanzaba a mano. Los cuatro han cazado algo real en esta sesión: `typecheck`
un `Decimal` de Prisma pasado a `.toFixed()`, `lint` hooks colocados después de
un `return` temprano, y los tests un `!== null` que debía ser una comprobación
de veracidad. No son ceremonia.

### Dos jobs

**`check`** hace lo que se hacía a mano, ordenado de más barato a más caro: un
desliz de formato falla en segundos en vez de después de un build de Next.

**`migrations`** levanta un Postgres limpio y aplica **todo el historial desde
cero**. Nadie lo había hecho nunca. Va con `continue-on-error`: una migración
que no aplica sobre una base vacía tampoco aplicará en producción y merece
saberse, pero no debe frenar un commit de documentación.

### Probado en local antes de subirlo

Base temporal, historial completo, seed dos veces:

```
All migrations have been successfully applied.
conteos tras DOS pasadas: {"property":1,"extra":3,"priceRule":1,"user":1,"taxJurisdiction":3}
idempotente ✓
```

Y la secuencia entera del workflow:

```
format:check ok   lint ok   typecheck ok   test ok   build ok
```

### Tres cosas que aparecieron al montarlo

**`format:check` fallaba desde antes**, por comillas en `docker-compose.yml`.
Añadirlo al CI sin arreglarlo habría hecho fallar la primera ejecución por algo
que no tenía que ver con el cambio.

**El seed aborta sin `ADMIN_SEED_PASSWORD`**, y hace bien: ningún entorno debe
acabar con un admin de contraseña por defecto. Pero eso significaba que mi
primera prueba de idempotencia no probaba nada — el seed moría a mitad. En CI
la contraseña se genera con `openssl rand` dentro del paso y muere con el
runner. Fijar una de usar y tirar en el workflow es cómo una de usar y tirar se
vuelve costumbre.

**`STRIPE_SECRET_KEY` va vacía**, a propósito. El código se niega a abrir el
pago sin clave en vez de inventarse una, y el build debe seguir demostrando eso.

### Corre en todas las ramas

No solo en `main`. Aquí se trabaja empujando a ramas de feature, y una
comprobación que solo aparece cuando existe un pull request es una que llega
después de haber construido encima del error. El precio es una ejecución
duplicada en las ramas que sí abren PR.

---

## 75. Fase 8.2 — El flujo de reserva, en un navegador

Nueve pruebas de punta a punta con Playwright, contra el API y la base
**reales**. Nada se simula: cada fallo que esta suite existe para cazar vivía en
una costura, y un API simulado no tiene costuras.

### Qué afirma, y por qué esas cosas

Cada aserción es sobre algo que se ha roto de verdad en este proyecto:

| Prueba                                         | Lo que evita repetir                                         |
| ---------------------------------------------- | ------------------------------------------------------------ |
| El desglose suma el total                      | Un backfill lo descuadró en exactamente $30 (§35)            |
| Un `total` enviado por el navegador se rechaza | `?total=1` compraba una semana (§21)                         |
| El hold toma la semana y devolverla la libera  | Fechas cerradas media hora por un pago que no se abrió (§72) |
| Dos huéspedes no compran la misma semana       | La restricción de exclusión (§29)                            |
| El checkout enseña el total del servidor       | Decirle un precio y cobrarle otro                            |
| Sin aceptar términos no se paga                | —                                                            |
| Sin nombre no se continúa                      | El botón fuera del `<form>` se saltaba los `required` (§30)  |
| Cada idioma bajo su locale                     | El rewrite de locale (§2)                                    |
| Una sesión inexistente no fabrica una reserva  | La confirmación declaraba éxito desde `localStorage` (§30)   |

### Dos tests míos afirmaban algo más débil que la realidad

Fallaron, y al mirarlos el código era **más estricto** de lo que yo había
supuesto:

- Asumí que un `total` enviado por el navegador se ignoraría. El API rechaza la
  petición entera con un 400 que nombra los campos. Ignorarlo también sería
  seguro, pero quien manda un total ha entendido algo mal y merece que se lo
  digan.
- Asumí que el botón de pagar abría el diálogo sin más. Está deshabilitado
  hasta aceptar los términos. Eso pasó de fallo a aserción propia.

Los tests se corrigieron hacia arriba; el código no se tocó.

### Se limpia con el propio código

Un hold se suelta llamando a `/abandon` — exactamente lo que hace un huésped que
se arrepiente. No hay endpoint de limpieza para tests: uno sería un agujero
permanente para ahorrar una llamada que ya existe.

Comprobado tras la ejecución, sobre la base real:

```
reservas dejadas por los E2E: 4
  AB-GVEW26  CANCELLED  2027-09-17  El huésped volvió atrás desde el pago
  AB-9KTWBF  CANCELLED  2027-09-27  El huésped volvió atrás desde el pago
  ...
ninguna bloquea fechas ✓
```

Reservan a **400 días vista** a propósito: la suite corre contra la misma base
que el panel, y usar la semana que viene chocaría con lo que la anfitriona tenga
de verdad y parecería una reserva real en su calendario.

### Dónde se detiene

En el traspaso a Stripe. Completar un pago significa manejar la página alojada
de Stripe, que es su interfaz y no la nuestra. Lo que sí se comprueba es que el
traspaso es real: una URL de sesión que pertenece a Stripe, para una reserva que
existe.

Y la suite es honesta **sin credenciales**: sin clave de Stripe el hold no puede
abrir un pago, así que afirma el otro camino —que las fechas se sueltan— en vez
de saltarse la prueba.

### En CI

Job propio con su Postgres. Solo Chromium: tres motores triplican los minutos
para volver a comprobar el mismo comportamiento de servidor, y una diferencia de
render no es para lo que está esta suite. El informe se sube como artefacto solo
cuando algo falla.

```
9 passed (21.2s)
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (308 unitarios)
```

---

## 76. Fase 8.3 — SEO técnico y accesibilidad

No había nada de SEO técnico: ni `robots.txt`, ni `sitemap.xml`, ni canonical,
ni hreflang, ni datos estructurados. En un sitio de **cinco idiomas** eso último
es lo que más cuesta: sin `alternates.languages`, un buscador ve cinco páginas
compitiendo por las mismas palabras en vez de una página en cinco idiomas.

### Lo añadido

- **`robots.ts`** — `/admin` fuera del índice. No es lo que lo protege (eso son
  el middleware y los guards); lo que evita es que la pantalla de login del
  panel salga al buscar la casa. `/my-booking` y `/confirmation` también,
  porque esas URLs llevan una referencia de reserva.
- **`sitemap.ts`** — una casa, cinco idiomas, con `x-default`. El checkout no
  está: es un paso de una transacción, y pedirle a un crawler que lo indexe es
  pedirle que indexe un carrito.
- **`metadataBase`** — sin él, una imagen de Open Graph es una ruta, y el
  servidor que renderiza un enlace compartido no tiene página contra la que
  resolverla. La vista previa salía en blanco.
- **Canonical y hreflang** en cada locale, y **fuera del `if` del CMS**: antes,
  un API caído significaba una página sin canonical, que es invitar al buscador
  a elegir uno por su cuenta.
- **`VacationRental` en JSON-LD** con dirección, capacidad, dormitorios, baños y
  horarios reales. Sin `aggregateRating` ni `review`: un rating que nadie dejó
  es de las cosas por las que a un listado le cae una penalización manual.

### Accesibilidad: un `??` que dejaba nueve botones sin nombre

La auditoría dio un solo fallo real, y su causa era pequeña:

```ts
alt={photo.caption ?? propertyName}
```

`??` solo captura `null` y `undefined`. **Nueve de las 46 fotos** tienen
`caption: ''`, y una cadena vacía no es null — así que esas nueve renderizaban
`alt=""` y el botón que las envuelve se quedaba sin nombre accesible. Un lector
de pantalla anunciaba "button" y nada más.

También el botón de cerrar la galería, que era un icono sin texto.

### Un test mío que reportaba cinco falsos positivos

La primera versión comprobaba a mano el texto, el `aria-label` y el `title`.
Un `<img alt="…">` dentro de un botón **sí** le da nombre a ese botón, y ninguna
comprobación hecha a mano sabe eso. Ahora usa `ariaSnapshot()`, que es el
cálculo del propio navegador.

```
- button "Cambiar idioma": ES
- button "Ver todas las fotos"
- button                        <- el único de verdad sin nombre
```

### Comprobado sirviendo, no leyendo el código

```
robots.txt   → Disallow: /admin, /my-booking, /confirmation + Sitemap:
sitemap.xml  → 5 locales + hreflang x-default
/es          → canonical + 6 alternates
JSON-LD      → VacationRental · St. Petersburg, Florida · 8 huéspedes
                3 dorm / 2 baños · 16:00–10:00 · desde $300
                ¿inventa rating? False
```

Siete pruebas nuevas en `e2e/seo-a11y.spec.ts` vigilan todo esto: son las
partes de una página que nadie mira, y por eso nada las caza salvo un test que
vaya a buscarlas.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (308 unitarios)
e2e SEO/a11y: 6 de 7 ✅
```

### Comprobado con Postgres arriba

El usuario levantó la base y la suite entera pasa:

```
16 passed (1.0m)
```

Las nueve del flujo de reserva y las siete de SEO y accesibilidad, incluida la
de datos estructurados que faltaba. Y sin residuo:

```
reservas de los E2E: 6   activas: 0   ninguna bloquea fechas ✓
reservas reales confirmadas: 7        intactas
```

---

## 77. Fase 8.4 — Producción

Una imagen por app, un compose para una sola máquina, y `docs/deployment.md`.

### La web: 78 MB en vez de más de un giga

`output: 'standalone'` hace que Next rastree los archivos que el servidor
realmente alcanza y los copie. En un monorepo de pnpm hace falta además
`outputFileTracingRoot`, o Next rastrea desde `apps/web` y se deja las
dependencias izadas a la raíz.

No pude construir la imagen —no hay Docker en esta máquina— así que probé **el
comando exacto** que ejecuta el Dockerfile:

```
node apps/web/server.js   →  ✓ Ready in 90ms
/es → 200   /robots.txt → 200   /sitemap.xml → 200
```

### El API no arranca desde `dist`, y eso decidió el diseño

Comprobado, no supuesto:

```
$ node dist/main.js
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  .../packages/shared/src/constants
  imported from .../packages/shared/src/index.ts
```

Los paquetes de `packages/` publican **TypeScript sin compilar**
(`"main": "./src/index.ts"`, sin script de build), así que el `dist` del API
pide un `.ts` que Node no sabe cargar.

La imagen corre con `ts-node --transpile-only`: exactamente lo que ya hacen
`pnpm start` y el job de E2E del CI. No es elegante y está dicho en el
documento. El arreglo correcto —dar un paso de compilación a esos paquetes y
apuntar `main` a `dist`— toca a la vez cómo resuelven Next, Jest y el API, y
merece hacerse solo, no de rebote dentro del despliegue.

### Decisiones que el documento explica en vez de esconder

- **Las migraciones no corren al arrancar.** Dos réplicas competirían por el
  mismo bloqueo, y una migración que falla en el arranque deja un bucle de
  reinicios en lugar de un error legible. Van como su propio paso.
- **`NEXT_PUBLIC_API_URL` se congela al construir.** Va compilada en el bundle
  del navegador, así que cambiarla es reconstruir la imagen. Por eso es un
  `build arg` y no una variable del servicio — y por eso está escrito, en vez
  de descubrirse en producción.
- **Postgres no publica puerto.** El API lo alcanza por la red del compose; un
  puerto en el host es un puerto que internet puede probar.
- **Las salud comprueban algo real.** El API responde sano solo cuando puede
  **leer la propiedad**: uno que contesta pero no llega a la base no sirve, y
  un orquestador no debe mandarle el primer huésped.
- **Ningún valor por defecto para un secreto.** `${JWT_SECRET:?set JWT_SECRET}`
  falla al levantar en lugar de arrancar con algo que el repositorio conoce.

### Una trampa que habría costado una tarde

Sin `BLOB_READ_WRITE_TOKEN`, `StorageService` escribe en
`apps/web/public/uploads` — que en este despliegue es el disco del contenedor
del **API**, no el de la web. La imagen se guarda y el sitio no la encuentra.
Documentado con sus dos salidas.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (308)   pnpm format:check ✅
```

---

## 78. Los paquetes compartidos ya compilan

La deuda que quedaba de §77: el API arrancaba con `ts-node` porque
`packages/shared` y `packages/types` publicaban TypeScript sin compilar, así que
`node dist/main.js` moría en `Cannot find module .../packages/shared/src/constants`.

### Por qué era delicado

Cinco cosas resuelven esos paquetes y cada una espera algo distinto: el API en
producción quiere JavaScript, el API en desarrollo quiere el fuente para que un
cambio se vea sin recompilar, Next quiere una cosa en `dev` y otra en `build`,
Jest los mapea al fuente por su cuenta, y `tsc` quiere declaraciones.

Apuntar `main` a `dist` y ya está habría roto lo segundo: editar
`packages/shared/src/pricing.ts` dejaría de llegar al servidor de desarrollo
hasta recompilar a mano — y nadie se acuerda de recompilar a mano.

### La solución: una condición en `exports`

```json
"exports": {
  ".": {
    "development": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
}
```

Node toma la primera condición que entiende. Comprobado, no supuesto:

```
sin condición   → packages/shared/dist/index.js
--conditions=development → packages/shared/src/index.ts
```

El `dev` del API pasa esa condición; Next la activa por su cuenta en
desarrollo y no en `build`. Turbo garantiza el orden con `dependsOn: ["^build"]`,
que ya estaba para build, lint, typecheck y test — solo hubo que añadirlo a
`dev`.

### Comprobado, paso a paso

```
node dist/main.js  →  Nest started  ·  /properties/areia-bela → 200
```

Y el desarrollo en vivo, cambiando `HOLD_TTL_MINUTES` de 30 a 31 en el fuente
con el servidor corriendo: `node --watch` reinició (dos arranques en el log)
mientras `dist` seguía diciendo 30. El cambio de prueba se revirtió.

```
pnpm typecheck ✅ (6 tareas)   pnpm lint ✅ (0 errores)
pnpm test ✅ (308)             pnpm build ✅ (4 tareas)
e2e contra el API COMPILADO: 16 passed (49.8s)
```

Esa última línea es la que cierra el asunto: la suite entera pasa contra
`node dist/main.js`, no contra el servidor de desarrollo.

### Lo que gana la imagen

El Dockerfile del API pasa de `pnpm start` con ts-node a `node dist/main.js`.
Sin toolchain de TypeScript dentro, y sin gestor de paquetes en el árbol de
procesos: una cosa menos entre una señal y la aplicación que tiene que
atenderla.

### Sigue diferido

- **El `dist` del API incluye los `.spec.js`.** `nest build` compila también los
  tests. Sobra peso, no rompe nada.

---

## 79. Cookies entre dominios, sin regalar el CSRF

Necesario para QA: en Cloud Run cada servicio recibe su propia URL `*.run.app`,
y entre dos dominios sin padre común `SameSite=Lax` no manda la cookie. El panel
no deja iniciar sesión y no dice por qué.

### Lo que había que mirar antes de tocarlo

Este API **no tiene token CSRF**. `SameSite=Lax` venía haciendo ese trabajo:
una petición desde otro sitio nunca llevaba la cookie, así que nunca iba
autenticada. Cambiarlo a `none` sin más no es un ajuste de configuración, es
quitar la única defensa que había.

Así que primero se comprobó qué queda protegiendo cada cosa:

| Superficie                                 | Con `none`                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Reembolsos, reservas, declaraciones (JSON) | **A salvo.** `application/json` exige preflight, y CORS responde con una lista donde el atacante no está. |
| Cuerpos de formulario                      | Eran un hueco: un `<form>` cruzado va sin preflight y Nest los parseaba por defecto.                      |
| Las dos subidas de imagen (multipart)      | Siguen alcanzables. Declarado.                                                                            |

### Lo hecho

**`COOKIE_SAMESITE`**, por defecto `lax`. Un valor que no se reconozca —una
errata— también cae en `lax`: una variable mal escrita no puede debilitar una
cookie en silencio. Pedir `none` fuerza `Secure`, porque el navegador descarta
`SameSite=None` sin él y el síntoma sería un login que no hace nada ni dice
nada.

**Se apaga el parser de formularios.** Nada aquí consume uno: todo es JSON y las
dos subidas las maneja multer. Un parser que nadie necesita es una puerta que
nadie vigila. Comprobado:

```
formulario cruzado  → HTTP 400
el mismo dato JSON  → HTTP 201
```

**Los tres sitios que emitían cookies ahora comparten una función.** Antes
coincidían por tener las mismas tres líneas copiadas, que es coincidir por
suerte.

### El cuerpo crudo del webhook, intacto

Apagar los parsers de Nest podía llevarse por delante la verificación de firma
de Stripe, que necesita los bytes exactos. Se reinstala `json()` con un `verify`
que los guarda, y se comprobó que la queja es la correcta:

```
webhook con firma falsa → {"message":"Invalid signature"}
```

Se queja de la **firma**, no de un cuerpo vacío.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (314 tests, 6 nuevos)
```

## 80. La cookie que nadie podía leer

Con QA ya desplegado en Cloud Run, el panel no dejaba entrar. El síntoma era
raro: `POST /auth/login` respondía **200**, con su `Set-Cookie` bien formado
—`HttpOnly; Secure; SameSite=None`— y CORS correcto. Y el navegador volvía al
login. En bucle, sin un solo error en ninguna consola.

No eran las credenciales: se verificó el login por `curl` contra el API
desplegado y devolvía el usuario `SUPERADMIN` real. No hacía falta ninguna
«cuenta maestra».

### Dónde estaba

En `apps/web/middleware.ts`, que protege `/admin` y hace:

```ts
if (request.cookies.has(ACCESS_TOKEN_COOKIE)) { ... }
```

Ese middleware corre en el servidor **de la web** y lee las cookies que llegan
a **su** host. La cookie la había puesto el API para el suyo. Nunca aparecía.

La sección 79 había puesto `SameSite=None` para este mismo problema, y era
necesario pero no suficiente: **`SameSite` decide si el navegador _adjunta_ una
cookie a una petición entre sitios; no dice nada sobre quién puede _leerla_.**
Faltaba la otra mitad.

En local no se veía porque `localhost:3000` y `localhost:3001` son el mismo
host —las cookies ignoran el puerto—. Dos URLs de Cloud Run no comparten nada:
`run.app` está en la Public Suffix List, justamente para que un servicio ajeno
no pueda escribir cookies sobre el tuyo. La misma protección que impedía el
ataque impedía el login.

### `COOKIE_DOMAIN`

`sessionCookieOptions` acepta ahora un dominio padre y lo normaliza a un punto
inicial. Con la web en `areia.example.com` y el API en `api.areia.example.com`,
`COOKIE_DOMAIN=areia.example.com` deja la cookie donde ambos la leen.

Y arreglarlo así **revierte** la concesión de la sección 79: vuelven a ser el
mismo sitio, `SameSite` regresa a `Lax`, y con él se van las cookies de
terceros —Safari y las ventanas privadas incluidas— y el agujero declarado de
los dos endpoints de subida de imágenes. `COOKIE_SAMESITE=none` queda como lo
que siempre debió ser: una salida para QA sin dominio propio.

Tres tests nuevos, y uno cubre el caso que rompería el arreglo en silencio:
una cadena vacía o en blanco produciría `Domain=.` y el navegador descartaría
la cookie entera, con el mismo síntoma mudo del principio.

### QA sobre un dominio real

Se mapeó contra un dominio existente del usuario (`t-soluciono.com`, en
Cloudflare), anidando el API bajo la web para que la cookie quede encerrada en
la rama `areia.` y el resto de servicios del dominio no la vean.

Dos cosas que costaron y quedan documentadas en `docs/deployment.md`:

- **Verificar el dominio padre en Search Console como propiedad de tipo
  Dominio**, no de prefijo de URL: la primera cubre todos los subdominios de
  una vez. Sin eso, `domain-mappings create` se niega.
- **En Cloudflare los `CNAME` van en gris**, y se crean en naranja por defecto.
  Con el proxy activo Google no valida el dominio y el certificado nunca llega.
  Además su SSL universal cubre un solo nivel de subdominio, y `api.areia.` son
  dos.

Reconstruir la web no era opcional: `NEXT_PUBLIC_API_URL` se compila dentro
del bundle del navegador. Y la imagen del API tampoco servía tal cual — era
anterior a este cambio, así que la variable sola no habría hecho nada.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (317 tests, 3 nuevos)
```

## 81. El cierre de sesión que no cerraba nada

Con el dominio ya funcionando, la comprobación del `Set-Cookie` del logout
salió así:

```
set-cookie: areia_bela_access=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

Sin `Domain`. Y una cookie se identifica por **nombre, dominio y ruta**: ese
borrado eliminaba una cookie del host que ya no existía, mientras la real
—la de `.areia.t-soluciono.com`, que puso la sección 80— seguía intacta en el
navegador. El logout devolvía `204` y la sesión sobrevivía.

Efecto acotado pero real: el refresh se revoca en servidor, así que la sesión
no se podía renovar, pero el access token seguía autenticando **hasta 15
minutos** tras pulsar «cerrar sesión». En un ordenador compartido eso importa.

Lo introdujo la propia sección 80. Antes no había `Domain` en ningún lado y
los tres `clearCookie` escritos a mano coincidían por defecto — la misma
coincidencia por suerte que esa sección decía haber eliminado, sobreviviendo
en los borrados porque solo se habían unificado las escrituras.

Los tres pasan ahora por `sessionCookieOptions`, la función que los escribe.

El test que lo cubre no comprueba un valor: recorre el árbol del API y exige
que **ninguna** llamada a `clearCookie` se salte esa función, porque el error
no vive dentro de ella sino en quien la ignora. Verificado en los dos
sentidos: falla al revertir uno de los tres, pasa con el arreglo. Y cuenta
cuántas llamadas inspeccionó, porque un escaneo que no encuentra nada pasaría
por el motivo equivocado.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (318 tests, 1 nuevo)
```

## 82. Un 401 que culpaba al huésped

Reservar desde el dominio nuevo devolvía `401 Unauthorized` en
`POST /bookings/areia-bela/hold` — un endpoint `@Public()` que ningún huésped
necesita autenticar. El log de Cloud Run lo aclaró:

```
www-authenticate: Bearer realm="Stripe"
rawType: 'invalid_request_error'
statusCode: 401
```

El 401 era de **Stripe**, rechazando la clave, y viajaba intacto hasta el
navegador.

### La causa: una variable con el valor de otra

`STRIPE_SECRET_KEY` en Cloud Run contenía un valor que empieza por `whsec_` —
el secreto de firma del webhook, no la clave de API, que empieza por `sk_`. Y
`STRIPE_WEBHOOK_SECRET` no estaba definido. El valor correcto, en la variable
equivocada.

Configuración, no código. Pero lo que hizo el código con ese error sí es un
fallo nuestro.

### Ningún estado de Stripe vuelve a salir al navegador

`checkoutUrlFor` dejaba escapar la excepción del SDK tal cual. Un huésped
pulsaba «pagar» y se le decía que **no estaba autorizado**, por un secreto del
servidor que él no puede ver ni arreglar: el estado señalaba a la persona
equivocada.

Y desorienta a quien lo depura. Este 401 mandó la investigación al guard, al
middleware y a las cookies —tres capas inocentes— antes de que el log de Cloud
Run apuntara a Stripe. Una clave que el servidor tiene mal es el servidor no
estando disponible, y eso es un **503**.

Todo fallo de Stripe al abrir el checkout se convierte ahora en
`ServiceUnavailableException`. El motivo real queda en el log, donde sirve y
donde el huésped no lo lee — el mensaje de Stripe llegó a incluir un fragmento
del secreto mal puesto.

Cuatro tests nuevos, uno por cada cosa que no debe repetirse: que un 401 de
Stripe salga como 503, que su mensaje no se repita al huésped, que la ausencia
total de clave siga fallando de forma distinta y ruidosa, y que el camino
bueno siga devolviendo la URL.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (322 tests, 4 nuevos)
```

## 83. Un log que decía haber enviado lo que no envió

En el log de QA, con un segundo de diferencia cero:

```
WARN [MailService]         BREVO_API_KEY not set — email NOT sent. To: egiraldom@outlook.com
LOG  [NotificationsService] Sent booking AB-NLFMMK confirmation to the guest
```

Dos entradas en el mismo milisegundo, y una de ellas falsa. Un log que afirma
un trabajo que nadie hizo es peor que no tener log: es la línea en la que
alguien va a confiar el día que busque por qué un huésped nunca recibió su
reserva.

### La causa era una firma, no cuatro mensajes

`MailService.send` devolvía `void` en sus tres caminos —sin clave, rechazado
por el proveedor y enviado—, así que ningún llamante podía distinguirlos.
Los cuatro loguearon lo mismo porque no tenían con qué decidir otra cosa.

Arreglar los mensajes uno a uno habría dejado el mismo agujero para el
siguiente. `send` devuelve ahora si el correo salió, y con eso los cuatro
avisos al huésped dicen lo que pasó.

Sigue sin lanzar excepción, a propósito: que el proveedor acepte o no un
mensaje no debe cambiar lo que responde un endpoint, o `/auth/forgot-password`
se convierte en una forma de averiguar qué direcciones tienen cuenta.

`NotificationChannel` tenía la misma forma y el mismo defecto — `deliver`
registraba `Sent "…" over Email` para todo intento— así que la interfaz
también devuelve ahora si entregó.

### Y una variable que no leía nadie

`docker-compose.prod.yml` pasaba `BREVO_SENDER_EMAIL` desde siempre. El código
lee `EMAIL_FROM_ADDRESS`. Ponerla no hacía nada: el remitente caía al valor por
defecto `no-reply@areiabela.com`, un dominio que el despliegue puede no
controlar, y Brevo rechaza los remitentes sin verificar. Un despliegue
configurado **exactamente como estaba documentado** no enviaba nada.

Se corrige el compose. El código llegó a aceptar los dos nombres para no
romper el despliegue que ya usaba el equivocado; en cuanto QA se renombró a
`EMAIL_FROM_ADDRESS`, el alias se eliminó: un segundo nombre que nadie usa solo
documenta un error pasado.

Cuatro tests nuevos: que sin clave devuelva `false` y no llame al proveedor,
que un rechazo devuelva `false`, que solo un `ok` devuelva `true`, y que el
remitente se lea de cualquiera de los dos nombres con el documentado ganando.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (326 tests, 4 nuevos)
```

## 84. Despliegue continuo a QA

La sección de diferidos decía: _«Sin CD. Automatizarlo antes de tener un dominio
y un servidor definidos sería automatizar una decisión que no está tomada.»_ Ya
están los dos.

Un merge en `main` dispara `cloudbuild.deploy.yaml`:

```
build-api ─→ push-api ─┐
build-web ─→ push-web ─┴→ migrate → deploy-api → deploy-web
```

**Cloud Build y no GitHub Actions**, aunque el CI viva en Actions: los
`cloudbuild.*.yaml` ya existían, y Actions necesitaría Workload Identity
Federation o —peor— una clave de cuenta de servicio en el repositorio. Actions
comprueba en cada rama, Cloud Build despliega desde `main`.

### Copias de seguridad primero

La instancia de Cloud SQL **no tenía copias**, y no solo guarda las reservas de
Areia Bela: es la misma que usa otra aplicación del usuario. Automatizar
migraciones sobre una base sin copias es convertir un fallo pequeño en pérdida
de datos, así que se activaron antes de tocar el pipeline: diarias más
recuperación a un punto en el tiempo, 7 días. Activar PITR reinicia la
instancia; se hizo con esa consecuencia declarada y aceptada.

### El trigger que ya existía y no servía

Había uno apuntando a `main`, creado automáticamente un segundo antes del
primer despliegue manual del API. Tenía `autodetect: true` —buildpacks, sin
`Dockerfile`—, que en este monorepo no construye lo que queremos. Solo un
`approvalRequired: true` había evitado que se disparase.

Se reescribió en lugar de crear otro: la API nueva de Cloud Build no tiene este
repositorio registrado, y ese trigger conservaba la conexión antigua de la
GitHub App, que sí funciona.

### Dos cosas que habrían roto el primer despliegue

**`DATABASE_URL` conecta por socket Unix, no por TCP.** El primer intento
levantaba el proxy en un puerto, y la migración no habría encontrado la base.
El proxy escucha ahora en la misma ruta que monta Cloud Run, así que el mismo
secreto vale sin tocarlo en los dos sitios — dos formas de la misma cadena
acaban divergiendo sin que nadie lo note.

**La lista `images:` se sube al terminar todos los pasos.** El primer intento
falló en `deploy-api` con `Image '.../api:prueba1' not found`: la imagen
existía en el disco del build y no en el registro. El `push` pasó a ser un paso
propio, antes de desplegar, y `images:` se eliminó para que no haya dos sitios
que suban lo mismo.

Las dos salieron de probar el pipeline a mano antes de que un merge dependiera
de él.

### Lo que el pipeline no toca

`gcloud run deploy` recibe solo `--image`. Variables y secretos son del entorno,
no del repositorio: un despliegue no debe poder reescribirlos por descuido.

Producción será otra cuenta y otro proyecto, con su propio trigger.

```
prueba completa ✅ (7/7 pasos, 5m21s)
web 200   api 200   /admin/login 200
```

## 85. El cotizador no aceptaba fechas

Tres fallos distintos se sumaban en la misma tarjeta, y ninguno se veía como un
error: la página no se rompía, simplemente no obedecía.

### 1. Una noche era imposible

`StayCalendar` pasaba `min={minNights + 1}` a react-day-picker, con este
comentario: _«`min` cuenta días seleccionados, y la salida es una mañana, así
que una noche es un rango de dos días»_. Es falso. `addToRange` compara
`differenceInCalendarDays(to, from)`, que **ya son noches**.

La casa acepta una noche, así que el `+1` exigía dos. Y fallaba en silencio:
elegir la salida al día siguiente devolvía `{ from: clicado, to: undefined }` —
el rango se descartaba y la llegada saltaba al día recién pulsado. Nada parecía
roto; las fechas simplemente no se quedaban.

Comprobado llamando a `addToRange` directamente, antes y después:

```
min = 2   clic llegada 10 sep, clic salida 11 sep  ->  { from: 11 sep }      (rango perdido)
min = 1   clic llegada 10 sep, clic salida 11 sep  ->  { from: 10, to: 11 }  (una noche)
```

### 2. La tarjeta abría con cero noches

Al llegar las tarifas, la llegada y la salida se decidían **por separado**:
cada una se quedaba si su día estaba libre y saltaba al primer hueco si no. Dos
decisiones independientes pueden caer en rangos distintos, o en el mismo día.
En QA abría literalmente `9/8/2026 → 9/8/2026 · $120 por 0 noches`.

La comprobación además solo miraba los **extremos**, así que un rango con
noches vendidas en medio pasaba por libre.

Ahora el par se mueve junto, y la guarda es _«¿ha elegido ya el huésped?»_ en
vez de _«¿sobreviven las fechas viejas?»_ — porque eso es lo que son: un valor
por defecto. Una respuesta que llega tarde no tiene por qué pisar a nadie.

### 3. Desajuste de hidratación, en producción

Las fechas iniciales salían de `addDays(new Date(), 1)` **durante el render**,
también en el servidor. Cloud Run corre en UTC y los huéspedes están en Florida:

```
servidor : Thu, 06 Aug 2026 01:56 GMT
navegador: Wed Aug  5 09:56 PM EDT
```

Desde las 8 de la tarde local, el servidor manda un HTML con una fecha y el
navegador calcula otra. React lo llama `#418`, tira el marcado del servidor y
repinta — cada tarde, para cada visitante, en la única tarjeta por la que la
página existe. Nadie lo vio porque el segundo pintado trae las fechas buenas.

Nada se deriva ya del reloj durante el render. Queda una prueba
(`e2e/hydration.spec.ts`) que carga el sitio con el navegador en husos a ambos
lados de la línea de cambio de fecha, para que uno siempre discrepe de la
máquina que la ejecuta. Verificada en los dos sentidos: el QA desplegado falla
con `#418` en `Pacific/Midway`, el código nuevo pasa.

### Y borrar la llegada dejaba una salida huérfana

Sin llegada no hay estancia más corta: no hay estancia. El calendario mostraba
nada seleccionado mientras la cabecera seguía leyendo una fecha, y el siguiente
clic la tiraba sin avisar. Borrar la llegada borra las dos; la salida sí puede
irse sola, porque eso deja medio rango que el calendario sabe dibujar.

## 86. El idioma, junto a la hamburguesa

En móvil el selector vivía dentro de la hoja lateral, como una rejilla de dos
columnas con cinco idiomas: «Deutsch» quedaba solo en la última fila, porque
cinco no se divide entre dos. Y los botones medían **38px de alto** contra los
44 recomendados para un objetivo táctil.

Ahora es un desplegable al lado del botón de menú. Cambiar de idioma es una
decisión que un visitante toma al llegar, y enterrarla tras la hamburguesa
pedía dos toques y adivinar dónde estaba.

**Una sola implementación para los dos tamaños.** Había dos —un desplegable
para pantallas anchas y la rejilla del móvil— y ya habían divergido: la del
móvil marcaba el idioma actual rellenándolo de azul, que gritaba más que el
botón de reservar justo encima. `compact` solo cambia el tamaño del disparador;
lo que abre es idéntico. Disparador de 44px, opciones de 44px, y la marca lleva
el estado en vez del relleno.

### Un patrón que engañaba al linter y a quien leía

Los dos recuadros de fecha se generaban mapeando `[[etiqueta, valor, borrar]]
as const`. Con la lógica nueva, `react-hooks` lo marcaba como acceso a una
`ref` durante el render — y tenía razón en no poder distinguir una flecha
creada en el render de una que solo corre al hacer clic. Dos recuadros son dos
recuadros: ahora es un componente `DateBox` invocado dos veces.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (326)   format:check ✅
```

Verificado en 360, 390, 768 y 1440px, y en los cinco idiomas: sin
desbordamiento horizontal en ninguno.

## 87. Por qué el calendario pedía dos clics

El primer toque en un día no hacía nada; el segundo sí. La causa no estaba en
ningún manejador, y encontrarla necesitó medir en vez de leer.

Un clic sintético (`el.click()` desde la consola) funcionaba a la primera. Uno
real, no. La diferencia es el ratón, y ahí estaba todo:

```
un solo hover  ->  60 renders del calendario
tras el hover  ->  el nodo del dia ya no es el mismo objeto
```

`onDayMouseEnter` estaba conectado directo al `setHoverDate` del padre y le
entregaba un `Date` **nuevo** cada vez. React nunca descarta un cambio de
estado cuyo valor es un objeto nuevo, así que: el puntero entra en el día →
render → el nodo bajo el cursor se sustituye → `mouseenter` se dispara sobre el
sustituto → otra vez. El `mousedown` caía en un elemento y el `mouseup` en su
reemplazo, y un navegador **solo emite `click` cuando ambos golpean el mismo
nodo**. El segundo clic funcionaba porque el hover ya había ocurrido.

Tres cosas mantenían el bucle vivo, y las tres eran identidades que cambiaban
sin que nada cambiara de verdad:

- `components={{ DayButton: (props) => ... }}` **escrito en línea**: un tipo de
  componente nuevo por render, así que React desmontaba y volvía a montar los
  61 botones en lugar de actualizarlos. Ahora es un `useMemo`, y `hoverDate`
  queda deliberadamente fuera de sus dependencias.
- `todayStart`, `taken`, `blocked` y el array `disabled`, todos recreados en
  cada render — y todos dependencias de ese memo.
- `defaultMonth`, recalculado en cada render. Un _mes por defecto_ es un valor
  inicial; cambiarlo a mitad de sesión reconstruía la rejilla.

Y dos guardas para que el bucle no pueda arrancar: el hover solo se sigue
mientras hay una estancia a medio elegir —fuera de eso no hay banda de vista
previa que dibujar— y el mismo día nunca se reporta dos veces.

### Las fechas empiezan vacías

La tarjeta ya no propone una estancia. Proponerla obligaba a que el primer
toque del huésped **corrigiera** algo en vez de elegirlo, y con los dos
extremos puestos ese toque solo movía la salida.

### Y reelegir borra lo anterior

Con un rango completo, react-day-picker arrastra el extremo más cercano: con
10–14 elegido, clicar el 20 daba 10–20. Nadie quiere decir eso al tocar otro
día — está eligiendo de nuevo. Ahora un clic sobre una estancia terminada
empieza otra desde ahí, y el huésped no tiene que borrar antes de repetir.

Cuatro pruebas en `e2e/quote-calendar.spec.ts`, con el gesto que hace una
persona —pasar el ratón y luego pulsar—, porque el `click()` atómico de
Playwright es más duro que cualquier mano.

## 88. El favicon

`public/images/favicon.png` es una estrella de mar cian sobre transparencia,
1536×1024. Un favicon es cuadrado, así que se recorta por el alfa y se centra
con un margen.

Dos versiones, porque el cian sobre blanco da un contraste de **1,9:1** —
perfecto en una pestaña oscura, casi invisible en una clara. La variante clara
se recolorea al azul de la marca y se le recorta el halo: a 32px un resplandor
suave no es atmósfera, es desenfoque. El icono de Apple lleva su propio fondo
azul, porque iOS compone sobre un mosaico sólido y un PNG transparente queda
mal.

Se eliminó `/icon.svg`: era el marcador de posición de la plantilla de Next
—un cuadrado negro redondeado— y los navegadores prefieren SVG cuando se les
ofrece, así que era **el que se estaba mostrando**.

El panel no declara metadatos propios, así que hereda los del layout raíz: web
y `/admin` comparten la marca sin duplicar nada. Verificado en el HTML servido
de `/es` y de `/admin/login`.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (326)   format:check ✅
e2e calendario ✅ (4/4)   e2e hidratacion ✅ (2/2)
```

## 89. La home sin sus secciones

Reportado como «no veo los demás módulos». Lo primero fue comprobar si lo había
roto yo: el QA desplegado, con el código anterior a los últimos cambios, servía
**49 KB y dos `<section>`**. No era una regresión, llevaba así desde el
despliegue.

### El CMS de QA está vacío

```
pages: 0   sections: 0   reviews: 0   faqs: 0   images: 0   settings: null
```

`seed:cms` y `seed:landing` nunca se corrieron: el despliegue ejecutó `seed` y
`seed:taxes` y ahí quedó. Documentado ahora en `docs/deployment.md`.

### Pero el código convertía «falta contenido» en «página en blanco»

`getSiteContent` marcaba `available: true` en cuanto el API respondía, y la
página trata esa bandera como _«manda el CMS»_: cada sección se pinta solo si
el CMS trae una. Con la base vacía el resultado era una portada con héroe,
tarjeta de reserva y nada más. Sin error, sin aviso, sin recurso.

Un CMS sin sembrar no es una anfitriona que borró todas las secciones; es un
CMS que no tiene nada que decir. `available` pasa a significar **que hay
contenido**, no que la petición no falló, y sin él la web usa los textos que
trae compilados — que es justo lo que el `catch` de al lado ya hacía.

### Y dos entradas del menú no llevaban a ninguna parte

La prueba nueva las encontró sola: `#amenities` estaba en la navegación desde
el principio y **ningún elemento lo definía**, así que «Servicios» hacía saltar
al principio de la página como un enlace muerto. El pie apuntaba a `#photos`,
que tampoco existe — la galería es `#gallery`.

Las tres anclas que sí existían aterrizaban **debajo** de la cabecera fija de
80px, con el título tapado. Ahora llevan `scroll-mt-24`.

Resultado, sobre la misma página: de 49 KB y 2 secciones a **137 KB y 7**, con
las cinco anclas resolviendo.

Dos pruebas en `e2e/home-sections.spec.ts`: que la portada traiga sus secciones
—con CMS sembrado o sin él— y que ningún enlace de ancla apunte al vacío. La
segunda es la que destapó `#amenities` y `#photos`.

```
pnpm build ✅   pnpm lint ✅ (0 errores)
pnpm typecheck ✅   pnpm test ✅ (326)   format:check ✅
e2e ✅ (8/8: portada, calendario, hidratacion)
```
