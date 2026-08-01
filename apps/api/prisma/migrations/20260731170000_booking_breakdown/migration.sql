-- The bill as charged, frozen on the booking. Recomputing it later would show
-- today's prices on a stay bought last season.
ALTER TABLE "Booking" ADD COLUMN "nightsSubtotal"     DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "weeklyDiscount"     DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "extrasTotal"        DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "additionalGuestFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "cleaningFee"        DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "serviceFee"         DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "taxes"              DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Where to finish paying while the hold is alive.
ALTER TABLE "Booking" ADD COLUMN "checkoutUrl" TEXT;

-- The house's cancellation policy, in the vocabulary guests know from Airbnb.
CREATE TYPE "CancellationPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'FIRM', 'STRICT');
ALTER TABLE "Property" ADD COLUMN "cancellationPolicy" "CancellationPolicy" NOT NULL DEFAULT 'MODERATE';

-- What every guest needs to know on arrival. Empty until the host writes it.
ALTER TABLE "Property" ADD COLUMN "accessNotes" TEXT;
