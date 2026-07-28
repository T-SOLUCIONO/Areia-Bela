# Variables de entorno

Solo **nombres y propósito**. Nunca valores reales — los `.env` están en
`.gitignore` y no deben commitearse (ver `AGENTS.md`).

Cada app tiene su `.env.example` con placeholders para copiar:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

## apps/api

| Variable                | Requerida       | Propósito                                                                                                                                                                                                                                 |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | sí              | Cadena de conexión a PostgreSQL (Prisma).                                                                                                                                                                                                 |
| `PORT`                  | no              | Puerto del API. Default `3001`.                                                                                                                                                                                                           |
| `JWT_ACCESS_SECRET`     | sí              | Firma los access tokens. **Mínimo 32 caracteres**; el API no arranca si falta o es más corto. Debe ser distinto por entorno.                                                                                                              |
| `TOTP_ENCRYPTION_KEY`   | sí              | Cifra los secretos TOTP en reposo (AES-256-GCM). Acepta 64 caracteres hex (32 bytes) o una passphrase de 32+ caracteres. **Si se pierde, nadie con 2FA activo puede volver a entrar** salvo con sus códigos de recuperación.              |
| `CORS_ORIGINS`          | no              | Orígenes permitidos, separados por coma. Default `http://localhost:3000`. No admite `*` porque las cookies requieren credenciales.                                                                                                        |
| `ADMIN_SEED_PASSWORD`   | solo al sembrar | Contraseña del admin inicial (`admin@areiabela.com`). Mínimo 12 caracteres. El seed **falla a propósito** si no está definida, para no crear una contraseña débil por defecto.                                                            |
| `NODE_ENV`              | no              | En `production` las cookies se emiten con `Secure`.                                                                                                                                                                                       |
| `BLOB_READ_WRITE_TOKEN` | en producción   | Token de Vercel Blob para guardar las fotos de la galería. Sin él, la subida escribe en `apps/web/public/uploads/` y el API lo avisa por log: sirve para desarrollo, pero en un host efímero esos archivos se pierden en cada despliegue. |
| `ANTHROPIC_API_KEY`     | en producción   | Traduce el contenido del sitio a inglés, portugués, francés y alemán cuando el anfitrión guarda. Sin ella nada se rompe: el sitio muestra el idioma en que se escribió, y el panel lo avisa con un aviso visible.                         |

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

Para activarla, una clave en `ANTHROPIC_API_KEY` (console.anthropic.com → API
Keys). Sin clave:

- `GET /cms/admin/translation-status` responde `{"configured": false}`.
- `/admin/content` muestra un aviso explicando que está apagada.
- El sitio sigue funcionando y muestra el español a todos los idiomas. Se
  degrada, no se rompe.

Dos reglas que evitan fallos silenciosos:

- Cada traducción guarda el hash del texto del que salió. Si el anfitrión edita
  el original, la traducción queda **caducada** y el sitio cae a la fuente en
  vez de mostrar la traducción de un texto que ya no existe.
- Una traducción que una persona editó (`isMachine: false`) no se vuelve a
  sobrescribir.

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

| Variable                             | Requerida | Propósito                                                                                                                          |
| ------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                | sí        | URL base del API. Sin ella el calendario público no puede excluir fechas bloqueadas (falla de forma suave) y el login no funciona. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | sí        | Clave pública de Stripe (checkout).                                                                                                |
| `STRIPE_SECRET_KEY`                  | sí        | Clave secreta de Stripe. Solo servidor.                                                                                            |

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
