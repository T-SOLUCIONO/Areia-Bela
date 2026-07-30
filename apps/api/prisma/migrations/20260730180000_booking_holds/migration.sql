-- Fase 6.3: a booking now holds its dates while the guest pays.

ALTER TABLE "Booking" ADD COLUMN "reference" TEXT;
ALTER TABLE "Booking" ADD COLUMN "pets" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "stripeSessionId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "cancellationReason" TEXT;

-- Existing rows need a reference before the column can be NOT NULL. There are
-- none today, but a migration that only works on an empty table is a trap for
-- whoever runs it against a restored dump.
UPDATE "Booking" SET "reference" = 'AB-' || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 6))
  WHERE "reference" IS NULL;
ALTER TABLE "Booking" ALTER COLUMN "reference" SET NOT NULL;

CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");
CREATE UNIQUE INDEX "Booking_stripeSessionId_key" ON "Booking"("stripeSessionId");
CREATE INDEX "Booking_status_expiresAt_idx" ON "Booking"("status", "expiresAt");

-- The race.
--
-- Checking "are these dates free?" and then inserting is two statements, and
-- two guests paying at the same second both read "free" before either writes.
-- No amount of application code closes that window; the database has to refuse
-- the second write.
--
-- btree_gist is what lets an equality column ("propertyId") sit in the same
-- GiST index as a range. The house is a single property today, but leaving it
-- out would make the constraint wrong the moment that stops being true.
--
-- '[)' is deliberate: check-out day is check-in day for the next guest, so
-- Sep 1-8 and Sep 8-15 must not count as overlapping.
--
-- CANCELLED is excluded because a cancelled stay gives its nights back. An
-- expired hold does NOT get a pass here -- the predicate cannot call now(), it
-- must be immutable -- so the service cancels expired holds inside the same
-- transaction as the insert. See BookingsService.hold().
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist (
    "propertyId" WITH =,
    daterange("checkIn"::date, "checkOut"::date, '[)') WITH &&
  ) WHERE ("status" <> 'CANCELLED');
