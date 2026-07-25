# Design Brief — Areia Bela

Referencia obligatoria para cualquier trabajo de UI (Fase 2 cleanup, Fase 5 CMS, Fase 8 pulido).
Evitar los defaults genéricos de IA: crema+terracota, negro+neón, estilo periódico.
Anclar todo en el sujeto real: casa de playa en el Golfo de Florida, piscina climatizada,
arena, atardeceres, madera clara.

## Paleta (usar exactamente estos tokens, no aproximar)

| Token                      | Hex       | Uso                                          |
| -------------------------- | --------- | -------------------------------------------- |
| `--color-bg`               | `#FAF6EF` | Fondo base, arena clara                      |
| `--color-text`             | `#2B3A3A` | Texto principal                              |
| `--color-accent-primary`   | `#1C6E71` | CTAs, links, iconos activos                  |
| `--color-accent-secondary` | `#E8895C` | Precios, badges, hover — usar con moderación |
| `--color-neutral`          | `#D9C9AE` | Bordes, dividers, skeleton loaders           |
| `--color-success`          | `#5B8C6E` | Estado "disponible" en calendario            |
| `--color-danger`           | `#C1443C` | Estado "ocupado/bloqueado", errores          |

Verificar contraste AA para `--color-accent-secondary` sobre `--color-bg` antes de usarlo en texto pequeño.

## Tipografía

- **Display**: peso alto, con carácter cálido/resort. Evitar Fraunces/Playfair (sobreusadas). Candidatas: Libre Caslon Text, Bricolage Grotesque.
- **Body**: sans humanista, legible en párrafos largos (hay mucho contenido: amenidades, políticas, FAQs). Candidatas: Inter, Public Sans. Tamaño base 16–17px, line-height 1.6.
- **Utilitaria**: para precios/fechas en el calendario y etiquetas — mono o small-caps.

## Layout y elemento signature

- El hero no es "foto + botón": usar la piscina climatizada / transición día-noche (luces de cuerda en patio) como elemento distintivo — algo que refleje lo que ofrece la casa y no un template genérico.
- Secciones estructuradas según el contenido real (Espacios, Cocina, Dormitorios, Exterior, Ubicación), no una grilla genérica de iconos de amenities.
- Mantener consistencia visual entre sitio público y admin/CMS.

## Responsive — no negociable

- Mobile-first real. Corregir `images: { unoptimized: true }` (detectado en la auditoría).
- Piso mínimo de prueba: iPhone SE (320px). Cero overflow horizontal.
- Calendario de reservas: 2 meses visibles en desktop (≥1024px), 1 mes en mobile (<640px).
- Targets táctiles ≥44px en todo el flujo de reserva.
- Respetar `prefers-reduced-motion` en animaciones de Framer Motion.
- Verificar en: iPhone SE, iPhone estándar, Pixel, Samsung, tablet Android, iPad, laptop, desktop, ultrawide.

## Proceso

1. Antes de construir una pantalla nueva: definir en 3 líneas paleta/tipo/layout específicos para esa pantalla (no reusar el token system genéricamente sin pensar en el contenido).
2. Revisar contra este brief antes de escribir código: si algo se ve como el default genérico, ajustarlo y explicar qué cambió.
3. Usar la skill `frontend-design` si está disponible en el entorno de Claude Code para guiar decisiones de diseño no cubiertas aquí.
4. Usar la skill `webapp-testing` (Playwright) para verificar responsive en los breakpoints listados arriba antes de cerrar cualquier tarea de UI.
