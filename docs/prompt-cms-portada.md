# Prompt — Llevar la portada entera al CMS

> Documento de trabajo, no parte del plan de migración. Pegar en Claude Code.

---

## Contexto

Repo `Areia-Bela`. Fase 5 acabó de cerrar: ya existe un CMS (`CMSPage`, `FAQ`,
`GalleryImage`, `SiteSettings`) con su pantalla en `/admin/content`, y el sitio
de huéspedes lee de ahí el SEO, la galería, las secciones largas, las preguntas
frecuentes y el contacto del pie.

Lo que **quedó fuera y es el objeto de este trabajo**: casi toda la portada
(`apps/web/app/[locale]/(public)/page.tsx`, ~500 líneas) sigue con el texto
incrustado en objetos bilingües dentro del componente, más `apps/web/lib/i18n.ts`.
Nada de eso se edita sin desplegar.

Antes de escribir código, **lee `CLAUDE.md`** y respétalo: una sola casa (nunca
`Room`/`RoomType`/canales), precio autoritativo en el servidor, datos reales o
hueco declarado —nunca inventados—, seed idempotente, documentación y commits en
español con el código en inglés, y conventional commits.

---

## Objetivo

Que el anfitrión pueda cambiar **todo** lo que ve un huésped en la portada desde
`/admin`, sin tocar código y sin desplegar.

---

## Qué tiene que quedar editable

Recorriendo la portada de arriba abajo:

### 1. Hero

- **Fotos**: ya salen de la galería del CMS (las 5 primeras). Falta que en
  `/admin/content` se **vea cuáles son las del hero** — hoy el anfitrión no
  tiene forma de saberlo.
- **Texto**: título, subtítulo y llamada a la acción. Hoy en `lib/i18n.ts`.
- **Insignias** (`Sleeps 8`, `Private Heated Pool`, `Pet Friendly`,
  `Family Ready`, `Fast Wi-Fi`): editar texto **e icono**, añadir y quitar,
  reordenar.

### 2. "Thoughtful touches for an unforgettable stay"

- El título y el subtítulo de la sección.
- Las tarjetas (`Coffee Bar`, `Family Game Corner`, `Beach Essentials`): cada
  una con **imagen, título, texto e icono**, y poder **añadir más**, quitar y
  reordenar.

### 3. Amenities

- Editar los tags existentes y **añadir nuevos**, con icono.

### 4. Reseñas

- **Poder ocultar la sección entera**, no solo editarla.
- Nota global, número de reseñas y las cuatro sub-notas (`Cleanliness`,
  `Communication`, `Location`, `Value`).
- Cada reseña: **foto del huésped**, nombre, fecha, texto, insignia de
  verificado. Añadir, quitar, reordenar.

### 5. Ubicación

- Título y texto ("Where you'll be staying", "St. Petersburg, Florida...").
- **El enlace/embed del mapa** — hoy está incrustado a mano en el JSX.
- "Highlights nearby": lista editable con icono.
- El bloque "Direct booking": título, texto y texto del botón.

### 6. Anfitriona

- Foto, nombre, insignia (`Superhost`), "Host since 2019", biografía.
- Las tres cifras (`10+ Reviews`, `< 1 hour Response`, `100% Response rate`):
  etiqueta y valor.
- Texto del botón de contacto y el correo al que escribe.

### 7. Pie y cabecera

- Texto del pie.
- **El logo**, tanto el del pie como el de la cabecera. Es lo más importante de
  este punto: hoy es un `/areia-bela-logo.png` fijo en `public/`.

---

## Traducción automática

Requisito del usuario: **no tener que escribir cada texto dos veces**.

Implementar un **botón "traducir"** por campo (o por sección) que llame a la API
de Claude y **rellene la otra columna como propuesta**, para que el anfitrión la
revise y guarde.

No hacerlo silencioso ni automático al guardar. La razón es de `CLAUDE.md`:
inventar traducciones está prohibido, y una traducción automática que se publica
sin que nadie la lea es exactamente eso. Con el botón, la máquina propone y la
persona responde por el texto.

- Clave nueva en `docs/env.md` **por nombre**, nunca el valor.
- Sin clave configurada, el botón se oculta o se deshabilita con su motivo — no
  se rompe nada.
- Marcar de algún modo el texto que viene de una traducción sin revisar.

---

## Decisiones de diseño que hay que tomar (razónalas antes de codificar)

1. **Modelo de datos.** Doce `CMSPage` con cuerpo de texto plano no sirven para
   tarjetas con imagen + icono + texto, ni para reseñas, ni para insignias.
   Hace falta algo con estructura. Evaluar al menos: un modelo `ContentBlock`
   genérico (tipo + orden + JSON tipado), o modelos concretos por sección
   (`HeroBadge`, `FeatureCard`, `Review`, `Highlight`...). Elegir y **justificar
   la elección en el changelog**, porque `domain-guard` exige justificar toda
   entidad nueva fuera de la lista canónica.
2. **Iconos.** El anfitrión no escribe nombres de `lucide-react` a mano. Hace
   falta un selector visual con un subconjunto curado.
3. **Imágenes.** Reutilizar `StorageService` y el flujo de subida que ya existe
   para la galería, no montar otro.
4. **Semilla.** El contenido actual de la portada es real (sale del anuncio y de
   las reseñas de verdad). Migrarlo al CMS con un seed **idempotente**, no
   empezar de cero ni reescribirlo.
5. **Respaldo.** Igual que en Fase 5: si el API no responde, la portada cae a la
   copia local en vez de romperse.
6. **Renderizado en el servidor.** El texto tiene que estar en el HTML, no
   aparecer tras la hidratación, o los buscadores no lo ven.

---

## Fuera de alcance de este trabajo

- **El cotizador.** Hay un problema real y aparte:
  `apps/web/lib/booking.ts:32` calcula el precio **en el navegador** leyendo el
  `datos.json` estático, y nadie llama a `POST /properties/:slug/quote`, que ya
  existe. Eso rompe la regla de precio autoritativo en el servidor y hace que lo
  que se edita en Ajustes no le llegue al huésped. Es Fase 6 y merece su propio
  cambio; **no mezclarlo con esto**.
- Las pantallas de huéspedes y cupones del panel, que siguen siendo de ejemplo.

---

## Antes de terminar

- `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` en verde.
- Verificar contra el API levantado que las escrituras exigen rol y que las
  lecturas públicas funcionan sin sesión.
- Comprobar que `GET /es` y `GET /en` traen el contenido nuevo **en el HTML**.
- Entrada en `docs/changelog.md` en español, diciendo también qué quedó
  diferido. Los huecos se documentan, no se tapan.
- Variables nuevas en `docs/env.md` por nombre. Los `.env` no se commitean.
