# Decisiones de dominio — Areia Bela

## Modelo de propiedad

Areia Bela se modela como **whole-home vacation rental** (1 unidad reservable),
no como hotel con inventario de habitaciones.

- 1 `Property` = la casa completa.
- Capacidad máxima: 8 huéspedes (adultos + niños >2 años cuentan; bebés ≤2 no).
- Huésped adicional sobre 8: $30/noche.
- 3 dormitorios (queen, queen, literas individuales) + sofá cama en sala.
- 2 baños remodelados.

## Idiomas

`es` y `en`, seleccionables desde el CMS. Todo contenido visible al usuario
(hero, secciones, FAQs, políticas, emails) debe existir en ambos idiomas desde
el primer seed.

## Reglas de negocio / extras (para `Extra` y `PriceRule`)

| Extra                  | Tipo                               | Precio    |
| ---------------------- | ---------------------------------- | --------- |
| Piscina climatizada    | Por noche, temporada oct 1 – may 1 | $20/día   |
| Niñera certificada RCP | Por hora, bajo pedido              | $20/hora  |
| Huésped adicional (>8) | Por noche                          | $30/noche |
| Mascota (gato o perro) | Por estancia, no reembolsable      | $115      |

**Descuento por estancia larga**: 10 % sobre las noches a partir de 7. Se
aplica solo a las noches, no a la limpieza ni a los extras. Editable desde el
panel (`Property.weeklyDiscountPercent` / `weeklyDiscountNights`).

## Penalizaciones / políticas (editable desde CMS, campos de `Property`)

- Filtro de piscina dañado por mascota: $150.
- No sacar la basura al finalizar la estancia: $50.
- Fiestas/reuniones grandes no permitidas: $999.
- Recolección de basura: miércoles y sábado por la mañana.
- Mantenimiento de césped (semanal) y piscina (2x/semana): acceso al patio sin aviso previo, salvo coordinación.

## Ubicación / traslados (para sección "Location")

- 5 min a Madeira Beach y Redington Beach.
- 10 min a Treasure Island.
- 5 min a Madeira Beach Marina.
- 25 min al Aeropuerto Internacional de Tampa (TPA).
- 20 min al Aeropuerto Internacional de St. Pete-Clearwater (PIE).

## Amenidades (para seed de `Property`/CMS)

Piscina climatizada, WiFi >150 Mbps down / >225 Mbps up, parking 4 vehículos,
se permite estacionar bote, pet-friendly, barra de café/aperitivos de cortesía,
parrilla, 2 bicicletas con candado, kit de playa (toallas, 3 sillas, sombrilla,
protector solar, carrito, hielera), corralito para bebés, TV Roku 55",
porche con mosquitero, rincón de juegos de mesa, estación de fotos.

## Seed inicial recomendado (Fase 3)

1. **Property**: Areia Bela, con todos los campos de este documento.
2. **Admin user**: `admin@areiabela.com`.
3. **Roles**: `superadmin`, `manager`, `viewer`.
4. **Extras**: piscina climatizada, mascota, huésped extra, niñera.
5. **PriceRules**: tarifa base, fin de semana, temporada alta.
6. **CMSPages** (es + en): about-space, accommodation, living-areas,
   kitchen-dining, bedrooms-bathrooms, outdoor-life, amenities, location,
   guest-access, house-rules, faqs, policies.
7. **SiteSettings**: contacto, WhatsApp, redes, SEO, check-in 16:00 / check-out 10:00.
8. **Gallery**: fotos migradas desde `datos.json` / URLs actuales.
9. **FAQs**: políticas de mascotas, basura, piscina, fiestas.
10. **BlockedDates**: un rango de ejemplo para testing del calendario.

## Fuera de alcance (no construir salvo que el negocio cambie)

`Room`, inventario por habitación, channel manager multi-propiedad,
housekeeping por habitación, reportes de ocupación por tipo de cuarto.
