# Despliegue

Dos imágenes y una base de datos. Los nombres de las variables están en
`docs/env.md`; aquí no hay ningún valor real, y no debe haberlo.

## Lo que hay que tener antes de empezar

1. **Postgres 15 o superior.** La restricción de exclusión que impide que dos
   huéspedes compren la misma semana necesita la extensión `btree_gist`; la
   migración la crea, pero el usuario de la base tiene que poder hacerlo.
2. **Un dominio con HTTPS.** Las cookies de sesión van `Secure` en producción,
   así que sobre HTTP el panel no deja iniciar sesión. No es un ajuste que
   convenga relajar.
3. **Las claves reales de Stripe.** Ver «Antes del primer cobro real» abajo.

## Arrancar

```bash
# Las variables vienen del entorno. Ninguna tiene valor por defecto en el
# compose: falta una, y `up` falla en vez de arrancar con algo que el
# repositorio conoce.
export POSTGRES_USER=... POSTGRES_PASSWORD=... POSTGRES_DB=...
export JWT_SECRET="$(openssl rand -base64 48)"
export PUBLIC_SITE_URL=https://tudominio.com
export NEXT_PUBLIC_API_URL=https://api.tudominio.com

docker compose -f docker-compose.prod.yml up -d --build
```

### Las migraciones van aparte, a propósito

```bash
docker compose -f docker-compose.prod.yml run --rm api pnpm prisma:deploy
```

No se ejecutan al arrancar el contenedor. Dos réplicas arrancando a la vez
competirían por el mismo bloqueo, y una migración que falla en el arranque deja
un bucle de reinicios en lugar de un error legible.

### El primer administrador

```bash
docker compose -f docker-compose.prod.yml run --rm \
  -e ADMIN_SEED_PASSWORD='...' api pnpm seed

docker compose -f docker-compose.prod.yml run --rm api pnpm seed:taxes
```

El seed **falla si no le das contraseña**, y hace bien: ningún entorno debe
acabar con un admin de contraseña por defecto. Es idempotente, así que correrlo
dos veces no duplica nada.

`seed:taxes` crea las tres jurisdicciones de Pinellas (6 % estatal + 1 % del
condado + 6 % de turismo). Sin él, la pantalla de Impuestos no tiene a quién
repartir lo recaudado.

## Dos cosas que sorprenden si no se saben

### La URL del API se congela al construir la imagen

`NEXT_PUBLIC_API_URL` se compila dentro del bundle del navegador. Cambiarla
significa **reconstruir la imagen**, no reiniciar el contenedor. Por eso es un
`build arg` y no una variable de entorno del servicio.

### Las imágenes que suba la anfitriona necesitan `BLOB_READ_WRITE_TOKEN`

Sin ese token, `StorageService` escribe en `apps/web/public/uploads` — que en
este despliegue es el disco del contenedor del **API**, no el de la web. La
imagen se guarda y el sitio no la encuentra.

Para producción hay dos salidas: definir `BLOB_READ_WRITE_TOKEN` (Vercel Blob),
o montar un volumen compartido entre ambos contenedores. La primera es la que
el código ya espera.

## Antes del primer cobro real

Estos tres puntos siguen pendientes del usuario y ninguno es de código:

1. **Rotar `STRIPE_SECRET_KEY`.** La actual es `sk_test_` y está en el historial
   de un repositorio público. Al generar la `sk_live_`, que no llegue nunca al
   repositorio: se pasa por entorno.
2. **Cuenta bancaria en USD** en Stripe (`dashboard.stripe.com/settings/payouts`).
   La cuenta está en `charges_enabled: false`; hasta activarla no cobra de
   verdad. Y el saldo antiguo en EUR sigue siendo euros.
3. **`STRIPE_WEBHOOK_SECRET`** del endpoint real, apuntando a
   `https://api.tudominio.com/bookings/stripe-webhook`. Sin él, un pago se
   confirma igualmente —por la reconciliación y por la comprobación al volver
   (§41)— pero Stripe acumula reintentos fallidos.

## Salud, y qué significa cada una

| Contenedor | Comprueba                    | Por qué esa                                                                         |
| ---------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `postgres` | `pg_isready`                 | —                                                                                   |
| `api`      | `GET /properties/areia-bela` | Toca la base. Un API que responde pero no puede leer la propiedad no sirve de nada. |
| `web`      | `GET /es`                    | Renderiza de verdad, no un `200` vacío.                                             |

El API no se declara sano hasta que puede leer la propiedad, así que un
orquestador no le manda tráfico mientras aún abre su pool de conexiones.

## Copias de seguridad

Lo único irrecuperable es la base: las reservas, los huéspedes, las facturas
congeladas y el libro de reembolsos. Las imágenes están en el blob y el código
en git.

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > copia-$(date +%F).sql.gz
```

Una copia que nadie ha restaurado nunca no es una copia. Conviene probar la
restauración sobre una base vacía antes de necesitarla.

## Diferido, y por qué

- **El API corre con `ts-node --transpile-only`, no desde `dist`.** No es una
  preferencia: los paquetes de `packages/` publican TypeScript sin compilar
  (`"main": "./src/index.ts"`, sin script de build), así que `node dist/main.js`
  muere con `Cannot find module .../packages/shared/src/constants`. Comprobado,
  no supuesto.

  El arreglo correcto es darles un paso de compilación y apuntar `main` a
  `dist`. Toca cómo resuelven Next, Jest y el API a la vez, así que es un
  cambio con su propio riesgo y merece hacerse solo, no de rebote en el
  despliegue. Mientras tanto, la imagen arranca con el mismo comando que
  `pnpm start` y que el job de E2E del CI.

- **El `dist` del API incluye los `.spec.js`.** Irrelevante mientras se ejecute
  desde el código fuente; a limpiar cuando se compile.

- **Sin CD.** El CI comprueba; desplegar sigue siendo manual. Automatizarlo
  antes de tener un dominio y un servidor definidos sería automatizar una
  decisión que no está tomada.
