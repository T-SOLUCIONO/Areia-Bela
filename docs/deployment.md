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

## Cómo se resuelven los paquetes compartidos

`packages/shared` y `packages/types` se compilan a `dist/` y declaran:

```json
"exports": {
  ".": {
    "development": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
}
```

Node elige la primera condición que entiende, así que:

| Quién                            | Qué carga         | Por qué                                     |
| -------------------------------- | ----------------- | ------------------------------------------- |
| `node dist/main.js` (producción) | `dist/index.js`   | Sin condición extra, cae en `default`.      |
| `pnpm dev` del API               | `src/index.ts`    | Arranca con `--conditions=development`.     |
| Next en desarrollo               | `src/index.ts`    | Webpack activa `development` por su cuenta. |
| `next build`                     | `dist/index.js`   | En producción esa condición no está.        |
| Jest                             | `src/index.ts`    | Su `moduleNameMapper` apunta al fuente.     |
| `tsc`                            | `dist/index.d.ts` | Lee la condición `types`.                   |

Editar un archivo compartido llega al servidor de desarrollo **sin recompilar**,
que es lo que hace que el esquema sea usable: si hiciera falta un build manual,
nadie se acordaría de hacerlo.

Turbo garantiza el orden con `dependsOn: ["^build"]` — los paquetes se compilan
antes que el API, la web, los tests y el typecheck.

## Diferido, y por qué

- **El `dist` del API incluye los `.spec.js`.** `nest build` compila también los
  tests. Sobra peso en la imagen, no rompe nada; se limpia excluyéndolos del
  `tsconfig.build.json` del API.

- **Sin CD.** El CI comprueba; desplegar sigue siendo manual. Automatizarlo
  antes de tener un dominio y un servidor definidos sería automatizar una
  decisión que no está tomada.

## Google Cloud

Cuatro servicios: **Cloud SQL** (Postgres), **Artifact Registry** (las imágenes),
**Cloud Run** (los dos contenedores) y **Secret Manager**.

### Tres cosas de este proyecto que Cloud Run rompe si nadie las mira

Antes de los comandos, porque son decisiones y no pasos.

**1. La reconciliación de pagos deja de correr si el servicio baja a cero.**

`PaymentReconciliationService` lleva un `@Cron(EVERY_10_MINUTES)` que busca
pagos cuyo webhook se perdió. Es la red de seguridad de §41 —la que salvó una
reserva pagada que se quedó en `PENDING`— y un contenedor dormido no ejecuta
nada.

Dos salidas:

- `--min-instances=1`. La instancia nunca duerme y el cron corre. Cuesta tener
  una instancia encendida siempre.
- Bajar a cero y que **Cloud Scheduler** dispare la reconciliación por HTTP.
  Hoy no se puede: es un método `@Cron`, no una ruta. Haría falta un endpoint
  protegido que la llame.

La primera es la que funciona sin tocar código.

**2. Las fotos que suba la anfitriona desaparecen en cada despliegue.**

`StorageService` guarda en Vercel Blob si hay `BLOB_READ_WRITE_TOKEN`, y si no,
en disco local. El disco de Cloud Run es efímero: se borra al reiniciar.

- Lo que funciona hoy sin tocar código: usar **Vercel Blob** igualmente. Es una
  API HTTP, da igual desde dónde se llame.
- Lo natural en GCP sería **Cloud Storage**, pero `StorageService` no lo
  soporta. Es un adaptador que hay que escribir.

**3. Las cookies de sesión entre dos dominios distintos.**

Cloud Run da a cada servicio un dominio propio (`...run.app`), y entre dos
dominios sin padre común `SameSite=Lax` no manda la cookie: el panel no deja
iniciar sesión. Ya está descrito en `docs/env.md`.

La salida limpia es un dominio propio con ambos bajo el mismo padre:
`areiabela.com` y `api.areiabela.com`. Se mapean en Cloud Run y `Lax` vuelve a
funcionar.

### La base de datos

```bash
gcloud sql instances create areia-bela \
  --database-version=POSTGRES_16 --tier=db-f1-micro --region=us-east1
gcloud sql databases create areia_bela --instance=areia-bela
gcloud sql users create areia --instance=areia-bela --password=...
```

La restricción de exclusión que impide que dos huéspedes compren la misma
semana necesita `btree_gist`. Cloud SQL la trae; la migración hace
`CREATE EXTENSION`, y para eso el usuario debe pertenecer a
`cloudsqlsuperuser` — el usuario que crea `gcloud sql users create` ya lo está.

Cloud Run se conecta por socket unix, así que la URL lleva `host`:

```
DATABASE_URL=postgresql://areia:CLAVE@localhost/areia_bela?host=/cloudsql/PROYECTO:us-east1:areia-bela
```

### Los secretos

Nunca como variables en claro del servicio:

```bash
printf '%s' "$(openssl rand -base64 48)" | gcloud secrets create jwt-secret --data-file=-
printf '%s' 'sk_live_...' | gcloud secrets create stripe-secret-key --data-file=-
```

Se montan con `--set-secrets JWT_SECRET=jwt-secret:latest`.

### Subir las imágenes

```bash
gcloud artifacts repositories create areia-bela --repository-format=docker --location=us-east1
gcloud auth configure-docker us-east1-docker.pkg.dev

REG=us-east1-docker.pkg.dev/PROYECTO/areia-bela
docker build -f apps/api/Dockerfile -t $REG/api:1 .
docker push $REG/api:1
```

### El orden importa: primero el API

`NEXT_PUBLIC_API_URL` se compila **dentro del bundle del navegador**, así que
hay que conocer la URL del API antes de construir la imagen de la web. En el
primer despliegue eso es un huevo y una gallina: se despliega el API, se lee su
URL, y con ella se construye la web.

```bash
gcloud run deploy areia-bela-api --image $REG/api:1 --region us-east1 \
  --add-cloudsql-instances PROYECTO:us-east1:areia-bela \
  --set-secrets JWT_SECRET=jwt-secret:latest,STRIPE_SECRET_KEY=stripe-secret-key:latest \
  --set-env-vars "DATABASE_URL=...,CORS_ORIGINS=https://areiabela.com,PUBLIC_SITE_URL=https://areiabela.com" \
  --min-instances=1 --port 3001 --allow-unauthenticated

API_URL=$(gcloud run services describe areia-bela-api --region us-east1 --format='value(status.url)')

docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
  --build-arg NEXT_PUBLIC_SITE_URL=https://areiabela.com \
  -t $REG/web:1 .
docker push $REG/web:1

gcloud run deploy areia-bela-web --image $REG/web:1 --region us-east1 \
  --port 3000 --allow-unauthenticated
```

Con dominio propio hay que reconstruir la web una vez más apuntando a
`https://api.areiabela.com`, y por eso conviene mapear los dominios antes de
dar la dirección a nadie.

### Migraciones y semilla, una sola vez

Cloud Run no ejecuta comandos sueltos. Se usa un **Cloud Run Job** con la misma
imagen:

```bash
gcloud run jobs create areia-bela-migrate --image $REG/api:1 --region us-east1 \
  --add-cloudsql-instances PROYECTO:us-east1:areia-bela \
  --set-env-vars "DATABASE_URL=..." \
  --command pnpm --args prisma:deploy

gcloud run jobs execute areia-bela-migrate --region us-east1
```

Lo mismo para `seed` (con `ADMIN_SEED_PASSWORD`) y `seed:taxes`.

### Qué falta comprobar tras el primer despliegue

1. `https://.../properties/areia-bela` responde 200 — el API llega a la base.
2. El panel deja iniciar sesión — las cookies cruzan entre los dos dominios.
3. Una reserva de prueba llega hasta Stripe y vuelve confirmada.
4. Subir una foto desde `/admin/content` y **volver a verla tras un
   despliegue** — si desaparece, es el punto 2 de arriba.
