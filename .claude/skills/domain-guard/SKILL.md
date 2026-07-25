---
name: domain-guard
description: Enforces the Areia Bela domain model (single whole-home property, not a hotel) whenever creating or modifying database schemas, Prisma models, TypeScript domain types, admin UI, or booking/availability logic. Use this whenever touching Property, Booking, Availability, Room, or related entities, or when scaffolding new modules under apps/api/src/modules or packages/types/src/domain.
---

# Domain Guard — Areia Bela

Areia Bela is a **single whole-home vacation rental** (1 reservable unit, capacity 8
guests, 3 bedrooms, 2 bathrooms). It is not a hotel. This skill exists because the
original codebase mixed both domains, which was already identified and fixed as a
deliberate decision — see `docs/domain-decisions.md`.

## Hard rules

1. **Never create, restore, or reference these concepts**, even if you find dead
   code or comments suggesting them:
   - `Room` / `RoomAvailability` / `RoomType` entities or tables
   - Multi-room inventory, room-level booking, room-level pricing
   - Channel manager / OTA multi-property sync
   - Housekeeping scheduled per room
   - Occupancy reports broken down by room type

   If you encounter this kind of code while working on something else, flag it as
   legacy debt to remove in the current phase's changelog — don't silently leave it,
   but also don't "fix" it as a side effect of an unrelated task without saying so.

2. **The correct entity set** is: `Property` (1 row), `Booking`, `Availability`,
   `Extra`, `PriceRule`, `Customer`, `Payment`, `CMSPage`. Any new entity you're
   tempted to add should map onto one of these or be justified explicitly in your
   summary of changes.

3. **Availability is date-based, not inventory-based.** A booking blocks a date
   range for the whole property. There is no partial availability.

4. **Pricing is always server-authoritative.** Never build a flow where the
   frontend sends a total price that the backend trusts directly. The backend must
   recalculate from `Property`, `PriceRule`, `Extra`, and the requested dates/guests.

5. **Guest counting rules** (from the real listing, don't invent different ones):
   - Max 8 guests base capacity.
   - Children over 2 years count as guests; infants ≤2 do not.
   - Guests above 8 incur a $30/night fee.
   - Pets: $100 flat, non-refundable, per stay.
   - Pool heating: $20/day, only relevant Oct 1 – May 1.

## When this skill applies

- Editing or creating Prisma schema files.
- Editing `packages/types/src/domain/*`.
- Working in `apps/api/src/modules/{properties,bookings,availability,pricing}`.
- Editing the booking calendar or admin reservation screens.
- Writing seed data.

## What to do if a request conflicts with this

If the person explicitly asks to add multi-property or multi-room support (e.g. the
business expands to a second house), that's a legitimate future evolution — but
confirm it explicitly as a scope change before touching the schema, since it's a
deliberate reversal of a documented decision, not a routine task.
