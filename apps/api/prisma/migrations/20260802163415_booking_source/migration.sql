-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WEBSITE', 'PANEL');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'WEBSITE';

