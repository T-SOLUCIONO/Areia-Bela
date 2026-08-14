-- Importar el calendario de Airbnb.
--
-- `source` separa lo que trae Airbnb de lo que la anfitriona bloquea a mano:
-- cada sincronización reemplaza lo suyo y no toca lo de ella. Por defecto
-- MANUAL, que es lo que son todas las filas que ya existen.
--
-- `externalId` es el UID del evento de iCal, que Airbnb mantiene estable entre
-- exportaciones. Es lo que hace que reimportar sea idempotente en vez de
-- duplicar en cada pasada. Único por propiedad, y nulo para los bloqueos
-- manuales: en Postgres los nulos no chocan entre sí, así que la restricción
-- solo alcanza a los importados.
--
-- La URL del calendario vive en los ajustes pero NO sale por /cms/site: ese
-- endpoint es público y desde este commit publica una lista blanca.

-- CreateEnum
CREATE TYPE "BlockedDateSource" AS ENUM ('MANUAL', 'AIRBNB');

-- AlterTable
ALTER TABLE "BlockedDate" ADD COLUMN "source" "BlockedDateSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "BlockedDate" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BlockedDate_propertyId_externalId_key" ON "BlockedDate"("propertyId", "externalId");

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN "airbnbIcalUrl" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "airbnbSyncedAt" TIMESTAMP(3);
ALTER TABLE "SiteSettings" ADD COLUMN "airbnbSyncError" TEXT;
