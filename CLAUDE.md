# Reglas generales — Areia Bela

Referenciado por `docs/migration-plan.md`. Para la estructura del código y las
convenciones de TypeScript, ver `AGENTS.md`.

## El dominio

Areia Bela es **una sola casa completa de alquiler vacacional** (1 unidad
reservable, 8 huéspedes, 3 dormitorios, 2 baños). **No es un hotel.**

- Entidades válidas: `Property` (1 fila), `Booking`, `Customer`, `Extra`,
  `PriceRule`, `BlockedDate`, `User`, `RefreshToken`, `RecoveryCode`.
- **Nunca** reintroducir `Room`, `RoomType`, inventario por habitación, channel
  manager multi-propiedad, housekeeping por habitación ni reportes de ocupación
  por tipo de cuarto. Si aparece código así, es deuda a eliminar, no un patrón
  a seguir.
- La disponibilidad es **por fechas**, no por inventario: una reserva bloquea el
  rango completo de la casa.
- El precio es **siempre autoritativo en el servidor**. El frontend nunca envía
  un total que el backend acepte sin recalcular.
- Toda entidad nueva fuera de la lista de arriba debe justificarse
  explícitamente en el changelog.

Detalle completo y reglas de negocio (huéspedes, mascotas, piscina
climatizada): `docs/domain-decisions.md`.

## Fases

`docs/migration-plan.md` manda. Reglas:

1. **Cada fase requiere aprobación explícita antes de empezar.**
2. Ninguna fase avanza sin cumplir su criterio de salida.
3. Adelantar trabajo de una fase posterior se declara como tal en el changelog,
   no se hace en silencio.
4. Cada fase deja su entrada en `docs/changelog.md`, incluyendo lo que quedó
   diferido o pendiente. Los huecos se documentan, no se tapan.

## Datos

Datos reales, no ficticios. Las fuentes son `apps/web/datos.json` (el listing
real scrapeado) y `docs/domain-decisions.md`. Si un dato no existe, se declara
el hueco en vez de inventar un valor plausible — inventar cifras de precio o
traducciones es peor que dejarlas pendientes.

El seed debe ser **idempotente** (upserts): correrlo dos veces no duplica nada.

## Seguridad

`.claude/skills/domain-guard/security-checklist/SKILL.md` es la lista vinculante
para cualquier trabajo de auth o `/admin`. Puntos que no se negocian:

- Contraseñas con Argon2. Nunca en claro ni con hashes débiles.
- Access tokens de vida corta; refresh tokens rotados en cada uso.
- Cookies de sesión `HttpOnly`, `Secure` en producción, `SameSite` explícito.
- Rate limiting y lockout en login.
- `/admin/*` protegido por middleware y guards reales, no solo un redirect.
- **Cero auth de demo.** Nada de formularios prellenados ni "always succeed",
  ni siquiera temporalmente.
- Variables de entorno documentadas en `docs/env.md` **por nombre**, nunca con
  valores reales. Los `.env` no se commitean.
- Al cerrar una fase de seguridad, el changelog dice qué ítems se cumplieron y
  cuáles se diferieron. No se omiten en silencio.

## Comandos

```bash
pnpm install      # pnpm, no npm ni yarn
pnpm dev          # solo apps/web
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

El API se levanta con `pnpm --filter @areia-bela/api dev` (puerto 3001) y
necesita PostgreSQL: `docker compose up -d postgres`.

## Idioma

- Documentación (`docs/*.md`) y mensajes de commit: **español**.
- Comentarios de código, nombres de variables e identificadores: **inglés**.
- El producto es bilingüe ES/EN: todo texto visible al usuario va traducido en
  ambos. Nunca concatenar un prefijo traducido con un dato que ya viene en un
  idioma fijo.

## Commits

Conventional commits, obligatorio (commitlint corre en un hook de Husky):
`tipo(scope): descripción`. Ramas de feature desde `main`.
