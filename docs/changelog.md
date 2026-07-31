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
