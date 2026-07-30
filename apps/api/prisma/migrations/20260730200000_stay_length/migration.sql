-- Fase 6: how short and how long a stay may be. Defaults match the real
-- listing (apps/web/datos.json): one night minimum, a year maximum.
ALTER TABLE "Property" ADD COLUMN "minNights" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Property" ADD COLUMN "maxNights" INTEGER NOT NULL DEFAULT 365;
