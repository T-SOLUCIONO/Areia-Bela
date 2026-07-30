-- The guest's confirmation email goes out in the language they booked in.
ALTER TABLE "Booking" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'es';
