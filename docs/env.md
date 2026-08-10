# Variables de entorno

Solo **nombres y propósito**. Nunca valores reales — los `.env` están en
`.gitignore` y no deben commitearse (ver `AGENTS.md`).

Cada app tiene su `.env.example` con placeholders para copiar:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

## apps/api

| Variable                            | Requerida       | Propósito                                                                                                                                                                                                                                 |
| ----------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | sí              | Cadena de conexión a PostgreSQL (Prisma).                                                                                                                                                                                                 |
| `PORT`                              | no              | Puerto del API. Default `3001`.                                                                                                                                                                                                           |
| `JWT_ACCESS_SECRET`                 | sí              | Firma los access tokens. **Mínimo 32 caracteres**; el API no arranca si falta o es más corto. Debe ser distinto por entorno.                                                                                                              |
| `TOTP_ENCRYPTION_KEY`               | sí              | Cifra los secretos TOTP en reposo (AES-256-GCM). Acepta 64 caracteres hex (32 bytes) o una passphrase de 32+ caracteres. **Si se pierde, nadie con 2FA activo puede volver a entrar** salvo con sus códigos de recuperación.              |
| `CORS_ORIGINS`                      | no              | Orígenes permitidos, separados por coma. Default `http://localhost:3000`. No admite `*` porque las cookies requieren credenciales.                                                                                                        |
| `ADMIN_SEED_PASSWORD`               | solo al sembrar | Contraseña del admin inicial (`admin@areiabela.com`). Mínimo 12 caracteres. El seed **falla a propósito** si no está definida, para no crear una contraseña débil por defecto.                                                            |
| `NODE_ENV`                          | no              | En `production` las cookies se emiten con `Secure`.                                                                                                                                                                                       |
| `GCS_BUCKET`                        | en despliegue   | Bucket de Google Cloud Storage para las fotos. Sin él ni `BLOB_READ_WRITE_TOKEN`, las subidas dan 404.                                                                                                                                    |
| `BLOB_READ_WRITE_TOKEN`             | en producción   | Token de Vercel Blob para guardar las fotos de la galería. Sin él, la subida escribe en `apps/web/public/uploads/` y el API lo avisa por log: sirve para desarrollo, pero en un host efímero esos archivos se pierden en cada despliegue. |
| `DEEPL_API_KEY`                     | en producción   | Traduce el contenido a inglés, portugués, francés y alemán al guardar. **Recomendado y gratuito** (500.000 caracteres/mes). Sin ninguna clave nada se rompe: el sitio muestra el idioma en que se escribió y el panel lo avisa.           |
| `TRANSLATION_PROVIDER`              | no              | Fuerza un proveedor: `deepl`, `libretranslate` o `claude`. Sin ella gana el primero configurado, empezando por DeepL.                                                                                                                     |
| `LIBRETRANSLATE_URL`                | no              | Instancia propia de LibreTranslate, si prefieres que los textos no salgan de tu servidor.                                                                                                                                                 |
| `ANTHROPIC_API_KEY`                 | no              | Traducir con Claude. De pago, pero es el único que entiende el contexto.                                                                                                                                                                  |
| `PUBLIC_SITE_URL`                   | sí              | Base de los enlaces que salen por correo (el de acceso del huésped). Sin ella se usa `http://localhost:3000`, y un enlace a localhost en el correo de un huésped no lleva a ninguna parte.                                                |
| `STRIPE_SECRET_KEY`                 | sí              | Abre la sesión de pago de Stripe. Sin ella `POST /bookings/:slug/hold` responde 503 y nadie puede reservar.                                                                                                                               |
| `TWILIO_ACCOUNT_SID`                | no              | Avisos por WhatsApp. Sin las tres variables de Twilio, todo llega igual por correo.                                                                                                                                                       |
| `TWILIO_AUTH_TOKEN`                 | no              | Token de esa cuenta.                                                                                                                                                                                                                      |
| `TELEGRAM_BOT_TOKEN`                | no              | Avisos por Telegram. El chat de destino se pone en el panel, no aquí.                                                                                                                                                                     |
| `META_WHATSAPP_TOKEN`               | no              | WhatsApp por el Cloud API de Meta. Se elige el proveedor en el panel.                                                                                                                                                                     |
| `META_WHATSAPP_PHONE_NUMBER_ID`     | no              | El id del número emisor en Meta, no el número.                                                                                                                                                                                            |
| `META_WHATSAPP_TEMPLATE`            | no              | Nombre de la plantilla aprobada con la que sale el aviso. Sin ella solo se entrega dentro de la ventana de 24 h. Ver «La plantilla de avisos».                                                                                            |
| `META_WHATSAPP_TEMPLATE_LANGUAGE`   | no              | Idioma con el que Meta aprobó la plantilla. Por defecto `es`.                                                                                                                                                                             |
| `META_WHATSAPP_BUSINESS_ACCOUNT_ID` | no              | Id de la cuenta de WhatsApp Business. Solo se usa para comprobar que la plantilla existe y está aprobada; sin él el panel no puede avisar de una plantilla inexistente.                                                                   |
| `TWILIO_WHATSAPP_FROM`              | no              | Número emisor, con código de país.                                                                                                                                                                                                        |

### Almacenamiento de imágenes (Vercel Blob)

La galería del panel sube archivos a Vercel Blob. Para activarlo:

1. En el proyecto de Vercel, Storage → Create → Blob.
2. Copiar el token de lectura/escritura que genera y ponerlo en
   `BLOB_READ_WRITE_TOKEN` del API (no del frontend: la subida es server-side).

Sin token no hace falta cuenta para trabajar en local; la carpeta
`apps/web/public/uploads/` está en `.gitignore` para que esas pruebas no se
commiteen.

### Traducción automática del sitio

El anfitrión escribe **una sola vez**, en español. Al guardar, el API traduce
ese texto a inglés, portugués, francés y alemán con la API de Claude y lo
guarda. El sitio de huéspedes sirve el idioma que pida el visitante; nunca
llama al modelo en tiempo de petición.

#### Qué proveedor elegir

|                         | Coste                          | Calidad                           | Notas                                                                                                    |
| ----------------------- | ------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **DeepL** (recomendado) | Gratis, 500.000 caracteres/mes | La mejor para estos cinco idiomas | El sitio entero son ~39.000 caracteres, así que retraducirlo todo gasta el 8% del cupo mensual           |
| **LibreTranslate**      | Gratis, sin cuenta             | Un escalón por debajo             | Autoalojado: los textos no salen de tu servidor. `docker run -p 5000:5000 libretranslate/libretranslate` |
| **Claude**              | De pago (centavos)             | Muy buena, y con contexto         | El único al que se le puede decir "esto es una casa, no un hotel"                                        |

Para DeepL: crear cuenta gratuita en deepl.com/pro-api, copiar la clave (las
del plan gratuito terminan en `:fx`) y ponerla en `DEEPL_API_KEY`. El código
detecta el sufijo y usa el host correcto — las claves gratuitas dan 404 contra
el host de pago, que es una forma confusa de descubrir el error.

**Nombres propios.** DeepL traduce topónimos: convirtió "St. Petersburg" en
"Saint-Pétersbourg", que es la ciudad rusa. La lista `PROTECTED_TERMS` de
`apps/api/src/cms/translation-providers.ts` los protege — se traduce cada uno
por separado una vez para aprender en qué los convierte, y se revierte en el
resultado. **Si añades un nombre propio nuevo al contenido** (otro punto de
interés, una marca), agrégalo a esa lista.

No se usa el glosario de DeepL, que sería lo natural: **el plan gratuito
permite un solo glosario por cuenta** y hacen falta cuatro, uno por idioma de
destino. Está documentado en `docs/changelog.md` §24 para que no se reintente.

LibreTranslate no tiene un mecanismo equivalente. Claude no lo necesita: se le
dice en el prompt, y no cometió este error.

Sin ninguna clave:

- `GET /cms/admin/translation-status` responde `{"configured": false}`.
- `/admin/content` muestra un aviso explicando que está apagada, y cuando sí lo está, **dice qué proveedor traduce**: a quién le llegan los textos no debería deducirse de la configuración del despliegue.
- El sitio sigue funcionando y muestra el español a todos los idiomas. Se
  degrada, no se rompe.

Dos reglas que evitan fallos silenciosos:

- Cada traducción guarda el hash del texto del que salió. Si el anfitrión edita
  el original, la traducción queda **caducada** y el sitio cae a la fuente en
  vez de mostrar la traducción de un texto que ya no existe.
- Una traducción que una persona editó (`isMachine: false`) no se vuelve a
  sobrescribir.

### Stripe y el webhook

**Las dos en `apps/api`, ninguna en el frontend.**

| Variable                | Para qué                           |
| ----------------------- | ---------------------------------- |
| `STRIPE_SECRET_KEY`     | Crear la sesión de pago            |
| `STRIPE_WEBHOOK_SECRET` | **Verificar la firma del webhook** |

La clave secreta vivía en `apps/web`, donde la usaba un route handler. Nunca
llegó a un navegador — esos handlers son de servidor — pero repartía Stripe
entre dos aplicaciones cuando el precio, la reserva y el webhook viven todos
aquí. Ahora `POST /bookings/:slug/hold` cotiza, reserva las fechas y abre el
pago en una sola llamada, y el frontend solo sigue la URL que recibe.

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` **ya no existe**: serviría para cargar
Stripe.js, y el sitio redirige a la página alojada de Stripe. Era una variable
que no leía nadie.

**Sin `STRIPE_WEBHOOK_SECRET` el webhook rechaza todo con un 400.** Es
deliberado: un webhook sin verificar es un endpoint donde cualquiera que sepa
la URL confirma una reserva que no pagó. Prefiere fallar a confirmar de más.

Para probarlo en local, con la CLI de Stripe:

```bash
stripe listen --forward-to localhost:3001/bookings/stripe-webhook
```

Imprime un `whsec_...` temporal; ese es el valor de la variable mientras dure
la sesión. En producción sale del panel de Stripe, al dar de alta el endpoint.

Eventos a los que suscribirse: `checkout.session.completed` y
`checkout.session.expired`.

### Avisos por WhatsApp (opcional)

Los avisos de reserva, cancelación y mensajes salen **siempre por correo** con
la misma cuenta de Brevo. WhatsApp es un canal añadido y necesita tres
variables; sin ellas, el panel lo dice y todo sigue llegando por correo.

| Variable               | Propósito                            |
| ---------------------- | ------------------------------------ |
| `TWILIO_ACCOUNT_SID`   | Cuenta de Twilio                     |
| `TWILIO_AUTH_TOKEN`    | Su token                             |
| `TWILIO_WHATSAPP_FROM` | El número emisor, con código de país |

Se eligió Twilio y no la API de Meta directamente porque Meta exige una cuenta
de empresa verificada y una plantilla aprobada por cada tipo de mensaje que
inicie el negocio, y eso son días de trámite. Con el _sandbox_ de Twilio se
envía hoy mismo. Cambiar de proveedor es reemplazar una clase en
`apps/api/src/notifications/notification-channels.ts`.

**La regla de las 24 horas** aplica con cualquier proveedor: fuera de una
ventana que abra el destinatario, solo entrega una plantilla aprobada. Para el
número de la anfitriona se resuelve respondiendo una vez al sandbox. Por eso
nada de esto escribe a un huésped: eso sí necesitaría plantillas.

**A dónde llegan** se edita en Ajustes → Contacto y SEO. Son campos aparte de
los públicos: la dirección a la que escribe un huésped rara vez es a la que la
anfitriona quiere que la despierten. Si se dejan vacíos, se usan los públicos.

### Correo (Brevo)

El restablecimiento de contraseña usa la API transaccional de Brevo. Para que
funcione de verdad hacen falta tres pasos fuera del código:

1. Crear la cuenta en brevo.com y generar una **API key transaccional**
   (Settings → SMTP & API → API Keys).
2. **Verificar el dominio** `areiabela.com` en Brevo (registros SPF/DKIM). Sin
   esto los correos salen, pero acaban en spam.
3. Poner `EMAIL_FROM_ADDRESS` con una dirección de ese dominio.

Mientras tanto, sin `BREVO_API_KEY` el flujo completo se puede probar en local:
el enlace aparece en el log del API.

## apps/web

| Variable              | Requerida | Propósito                                                                                                                          |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | sí        | URL base del API. Sin ella el calendario público no puede excluir fechas bloqueadas (falla de forma suave) y el login no funciona. |

El frontend **no** necesita `JWT_ACCESS_SECRET`: el middleware solo comprueba
que exista la cookie de sesión, y la verificación real la hacen el layout
server-side (`GET /auth/me`) y los guards del API. Así el secreto vive en un
único lugar.

## Generar secretos

```bash
# JWT_ACCESS_SECRET
openssl rand -base64 48

# TOTP_ENCRYPTION_KEY (64 hex = 32 bytes)
openssl rand -hex 32
```

## Cookies en despliegue cross-site (leer antes de ir a producción)

Las cookies de sesión se emiten con `HttpOnly`, `SameSite=Lax` y `Secure`
cuando `NODE_ENV=production`.

En local funciona sin más: `localhost:3000` y `localhost:3001` son **same-site**
(el puerto no cuenta para efectos de cookies).

En producción, si el frontend y el API quedan en **dominios distintos**
(p. ej. `areiabela.com` y `api.areiabela.com`), `SameSite=Lax` deja de enviar
la cookie y el login no funcionará. Dos salidas:

1. **Recomendada**: servir el API bajo el mismo dominio (subruta `/api` vía
   proxy inverso, o route handlers de Next que reenvíen al API). Todo queda
   same-origin y `Lax` sigue sirviendo, que es la opción más segura.
2. **Alternativa**: cambiar a `SameSite=None` + `Secure` (obliga HTTPS) y añadir el
   dominio del frontend a `CORS_ORIGINS`. Funciona, pero `None` expone la
   cookie a peticiones cross-site y conviene evitarlo si se puede.

La decisión aún no está tomada porque el despliegue definitivo no está
definido; queda documentada aquí para no descubrirla en producción.

## Integración continua

`.github/workflows/ci.yml` corre en cada push y en cada pull request. No
necesita ningún secreto configurado en GitHub:

| Variable              | De dónde sale en CI                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Apunta al Postgres del propio job. Solo el job de migraciones se conecta de verdad; los tests usan mocks.                                                                                                                                         |
| `STRIPE_SECRET_KEY`   | Vacía a propósito. El código se niega a abrir el pago sin clave en vez de inventarse una, y eso es justo lo que debe seguir haciendo.                                                                                                             |
| `ADMIN_SEED_PASSWORD` | Se genera con `openssl rand` dentro del paso y muere con el runner. El seed se niega a inventar una contraseña de admin (y debe seguir negándose), pero fijar una de usar y tirar en el workflow es cómo una de usar y tirar se vuelve costumbre. |

El job de migraciones va con `continue-on-error`: aplicar el historial completo
sobre una base vacía es información valiosa —una migración que no aplica desde
cero tampoco aplicará en producción— pero no debe frenar un commit de
documentación.

## Tests end-to-end

`apps/web/e2e/` corre con Playwright contra el API y la base **reales**. Nada se
simula: los fallos que esta suite existe para cazar vivían en las costuras, y un
API simulado no tiene costuras.

```bash
# Con Postgres, el API (3001) y la web (3000) levantados:
pnpm --filter @areia-bela/web test:e2e
pnpm --filter @areia-bela/web test:e2e:ui   # con inspector
```

| Variable        | Para qué                                                                         |
| --------------- | -------------------------------------------------------------------------------- |
| `E2E_BASE_URL`  | Dónde escucha la web. Por defecto `http://localhost:3000`.                       |
| `E2E_API_URL`   | Dónde escucha el API. Por defecto `http://localhost:3001`.                       |
| `E2E_NO_SERVER` | Definida, Playwright no levanta la web él mismo — para cuando ya está corriendo. |

Dos cosas que la suite hace a propósito:

- **Reserva a 400 días vista.** Corre contra la misma base que el panel, así que
  usar la semana que viene chocaría con lo que la anfitriona tenga de verdad y,
  peor, parecería una reserva real en su calendario.
- **Se limpia sola con el propio código.** Un hold se suelta llamando a
  `/abandon`, que es exactamente lo que hace un huésped que se arrepiente. No
  hay endpoint de limpieza para tests: uno sería un agujero permanente para
  ahorrar una llamada que ya existe.

Se detiene en el traspaso a Stripe. Completar un pago significa manejar la
página de Stripe, que es su interfaz y no la nuestra. Lo que sí se comprueba es
que el traspaso es real: una URL de sesión que pertenece a Stripe, para una
reserva que existe.

## `COOKIE_SAMESITE`

| Valor                     | Cuándo                                                                |
| ------------------------- | --------------------------------------------------------------------- |
| sin definir (por defecto) | `SameSite=Lax`. La postura correcta.                                  |
| `none`                    | El sitio y el API viven en dominios sin padre común. Fuerza `Secure`. |

`Lax` es lo que hay que usar, y para eso el sitio y el API deben compartir
dominio padre: `areiabela.com` y `api.areiabela.com`. Dos URLs `*.run.app` no lo
comparten, y entonces el navegador no manda la cookie: el panel no deja iniciar
sesión, sin ningún error visible.

`none` existe para ese caso y **no es gratis**. Este API no tiene token CSRF;
`Lax` venía haciendo ese trabajo, porque una petición desde otro sitio nunca
llevaba la cookie. Con `none` eso deja de ser cierto, y lo que queda es:

- **Lo que mueve dinero sigue a salvo.** Reembolsos, reservas y declaraciones
  son JSON, y `application/json` no es una petición «simple»: el navegador
  manda un preflight antes, y CORS responde con una lista en la que el atacante
  no está.
- **Los formularios ya no se parsean.** Un `<form>` de otro sitio se envía sin
  preflight, así que `main.ts` apaga el parser de formularios de Nest. Nada aquí
  consume uno, y un parser que nadie necesita es una puerta que nadie vigila.
- **Las dos subidas de imagen siguen alcanzables.** `multipart/form-data`
  tampoco lleva preflight. Es el único hueco que `none` deja abierto: exige un
  admin ya identificado y lo peor que consigue es una imagen no deseada en la
  galería. Se declara en vez de ocultarse.

Por eso `none` es un intercambio razonable para un entorno de QA en dos dominios
sueltos, y el valor equivocado para producción.

## `COOKIE_DOMAIN`

El dominio padre que comparten el sitio y el API. Sin definir, cada uno pone su
cookie en su propio host.

```
COOKIE_DOMAIN=areiabela.com     # sitio en areiabela.com, API en api.areiabela.com
```

**`SameSite` resuelve la mitad del problema, y esta variable la otra.** `SameSite`
decide si el navegador **adjunta** una cookie a una petición entre sitios; no
dice nada sobre quién puede **leerla**.

El panel lo protege `apps/web/middleware.ts`, que corre en el servidor de la web
y lee las cookies que llegan a **su** host. Una cookie que el API puso para el
suyo nunca llega ahí: el login responde 200, el guard no ve nada, y el usuario
vuelve al login. En bucle, y sin ningún error.

En local no se nota, porque `localhost:3000` y `localhost:3001` comparten el
host `localhost` — las cookies ignoran el puerto. Dos URLs de Cloud Run no
comparten nada: `run.app` está en la Public Suffix List, así que cada subdominio
es un sitio distinto.

Con el padre compartido, además, **`COOKIE_SAMESITE` deja de hacer falta**:
vuelven a ser el mismo sitio, `Lax` funciona, y con él desaparece el problema de
las cookies de terceros —Safari y las ventanas privadas incluidas.

El precio: cualquier subdominio de ese padre puede leer la cookie de sesión.
Conviene saberlo antes de apuntar un tercer servicio al mismo dominio.

## Avisos al anfitrión: qué canal elegir

Tres canales, y no son equivalentes.

**Correo** funciona con `BREVO_API_KEY` y es el mínimo. Llega siempre, y llega
tarde: nadie mira el correo a las tres de la mañana.

**Telegram** (`TELEGRAM_BOT_TOKEN`) es el recomendado para avisos. Sin ventanas
de tiempo, sin plantillas que aprobar, sin coste y entrega inmediata. Montarlo:

1. Hablar con `@BotFather`, `/newbot`, guardar el token.
2. Escribirle **cualquier cosa** al bot recién creado. Sin ese primer mensaje
   Telegram no le permite responder, que es también lo que impide que un bot
   escriba a desconocidos.
3. Abrir `https://api.telegram.org/bot<TOKEN>/getUpdates` y copiar
   `result[0].message.chat.id`.
4. Pegar ese id en el panel, en Ajustes → Avisos. **No es un teléfono**, y puede
   ser negativo si es un grupo.

**WhatsApp** (las tres variables de Twilio) arrastra la regla de las 24 horas:
fuera de una ventana que el destinatario haya abierto escribiendo él, solo
entregan plantillas aprobadas por Meta. Un aviso de reserva es, por definición,
iniciado por el negocio. Con el sandbox de Twilio la ventana caduca y hay que
reabrirla; en producción hace falta remitente de WhatsApp Business y aprobación
de plantillas. Tiene coste por mensaje.

El panel distingue **«falta el chat id»** de **«falta el token en el API»**: son
dos problemas con dueños distintos, y una sola señal para ambos mandaría a la
anfitriona a buscar donde no es.

### Los dos proveedores de WhatsApp

Se elige en el panel, en Ajustes → Avisos. Solo trabaja uno a la vez: mandar el
mismo mensaje dos veces es ruido, no redundancia.

|               | Twilio                                                            | Cloud API de Meta                                      |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| Variables     | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID` |
| Empezar       | Sandbox, envía hoy                                                | Cuenta de Business y número verificado                 |
| Remitente     | Número compartido                                                 | El tuyo                                                |
| Coste         | Margen de reventa sobre la tarifa de Meta                         | La tarifa de Meta                                      |
| Regla de 24 h | Sí                                                                | **Sí, igual**                                          |

**Ninguno de los dos se libra de la regla de las 24 horas.** Es de WhatsApp, no
del revendedor: fuera de una ventana que el destinatario haya abierto
escribiendo él, solo llegan plantillas aprobadas. Elegir Meta esperando que
desaparezca es elegirlo por el motivo equivocado — para avisos no solicitados,
Telegram sigue siendo el canal correcto.

`META_WHATSAPP_PHONE_NUMBER_ID` **no es el número de teléfono**: es el id que
Meta le asigna, visible en el panel de WhatsApp de tu app de Meta.

**Si el proveedor elegido no tiene credenciales, no se sustituye por el otro.**
Elegir Meta y que salga por Twilio significaría que el panel dice una cosa y el
teléfono muestra otra, sin motivo para que nadie lo mire. En su lugar el panel
señala qué falta y distingue si el otro proveedor está listo para cambiarse —
porque poner credenciales es un despliegue y cambiar de proveedor es un clic.

## Dónde van las fotos que sube la anfitriona

Tres destinos, y el orden de preferencia es este:

1. **`GCS_BUCKET`** — Google Cloud Storage. Es lo que usa el despliegue.
2. **`BLOB_READ_WRITE_TOKEN`** — Vercel Blob. Sigue funcionando; estaba antes.
3. **Nada** — disco local. **Solo para `pnpm dev`.**

El tercero es una trampa fuera de desarrollo y conviene entender por qué: el API
escribe el archivo en `apps/web/public/uploads` y devuelve `/uploads/<nombre>`,
una ruta que sirve **la web**. En cualquier despliegue son dos contenedores
distintos, así que el archivo queda en uno y la URL apunta al otro. La subida
responde bien, la base guarda la URL y la imagen da 404 para siempre. El panel
avisa cuando está en ese modo, porque el fallo es silencioso por construcción.

### Montar el bucket

```bash
gcloud storage buckets create gs://TU-BUCKET \
  --location=us-central1 --uniform-bucket-level-access

# Los visitantes leen las fotos...
gcloud storage buckets add-iam-policy-binding gs://TU-BUCKET \
  --member=allUsers --role=roles/storage.legacyObjectReader

# ...y el API escribe y borra.
gcloud storage buckets add-iam-policy-binding gs://TU-BUCKET \
  --member=serviceAccount:LA-CUENTA-DEL-API --role=roles/storage.objectAdmin
```

**`legacyObjectReader` y no `objectViewer`.** El segundo también concede listar
el bucket, y nadie de fuera tiene por qué poder enumerar qué hay dentro.
Comprobado: leer un objeto sin credenciales devuelve `200`, listar devuelve
`401`.

**Sin fichero de claves.** El cliente usa Application Default Credentials: en
Cloud Run eso es la propia cuenta de servicio del API, y en local
`gcloud auth application-default login`. No hay ninguna credencial que filtrar.

Los objetos se guardan con `cache-control: immutable` a un año. Es seguro porque
el nombre lleva doce bytes aleatorios: una URL siempre responde con la misma
foto, y reemplazarla genera un nombre nuevo en vez de una caché rancia.

### Cuidado al escribir un secreto desde la terminal

`gcloud secrets versions add X --data-file=-` guarda **el Enter que termina el
pegado** dentro del secreto. Un token que acaba en `\n` construye una cabecera
`Authorization` malformada, y el error no menciona el salto de línea en ningún
momento. La forma segura, que además no deja el valor en el historial del shell:

```bash
printf %s "$(cat)" | gcloud secrets versions add areia-meta-whatsapp-token --data-file=-
```

Crear el secreto y darle contenido son **dos pasos**. `gcloud secrets create` con
una entrada vacía deja el contenedor creado y sin versiones, y entonces Cloud Run
falla con `versions/latest was not found` — que suena a que el secreto no existe
cuando lo que no existe es su contenido. Se comprueba con
`gcloud secrets versions list <nombre>`.

Del lado del código, todas las credenciales de avisos se leen recortadas y un
valor que solo tenga espacios cuenta como no configurado: presente e inservible
es peor que ausente, porque reportaría un canal listo que no puede enviar.

### La plantilla de avisos de Meta

Sin plantilla, el canal de Meta manda texto libre, y Meta solo entrega texto
libre **dentro de una ventana de 24 h abierta por el destinatario**. Un aviso de
reserva es iniciado por el negocio por definición, así que fuera de esa ventana
no llega. La plantilla es la única forma de que llegue siempre.

Hay que crearla en `business.facebook.com` → WhatsApp Manager → Plantillas de
mensajes, y esperar la aprobación de Meta.

- **Nombre**: `areia_bela_aviso` (o el que sea; va en `META_WHATSAPP_TEMPLATE`)
- **Categoría**: `Utility` — es una notificación de una transacción, no
  marketing. Elegir `Marketing` la haría rechazable y cobrable como tal.
- **Idioma**: español (`es`), el mismo que `META_WHATSAPP_TEMPLATE_LANGUAGE`
- **Cuerpo**, exactamente con dos parámetros:

```
*{{1}}*

{{2}}

Abre el panel de Areia Bela para ver el detalle.
```

- **Valores de ejemplo** que pide Meta al enviarla a revisión:
  - `{{1}}`: `Nueva reserva · 2026-09-01`
  - `{{2}}`: `Jane Doe · 4 huéspedes · 2026-09-01 → 2026-09-08 · Total: $2483`

Dos parámetros y no uno por dato, a propósito: cada `{{n}}` es un número que
tiene que coincidir entre el código y un texto que está en la cola de revisión
de Meta, y un descuadre hace fallar el envío sin nada útil en el log. Un título
y un resumen de una línea llevan los cuatro avisos —reserva, cancelación,
modificación y mensaje— con una sola aprobación.

**No definir `META_WHATSAPP_TEMPLATE` antes de que la plantilla esté aprobada.**
Es peor que dejarla vacía: sin plantilla el canal manda texto libre, que al menos
llega dentro de una ventana abierta, mientras que un nombre que Meta no reconoce
hace fallar **todos** los envíos. Con `META_WHATSAPP_BUSINESS_ACCOUNT_ID`
definido, el panel lo detecta y lo dice; sin él, no puede.

**El salto de línea va en la plantilla, no en el parámetro.** Meta rechaza un
parámetro que contenga un salto de línea, un tabulador o más de cuatro espacios
seguidos, y rechaza el mensaje entero, no el carácter. Los avisos se construyen
por líneas, así que el código las aplana con `·` antes de enviarlas:
la maquetación vive en el texto aprobado y los datos llegan en una sola línea.
