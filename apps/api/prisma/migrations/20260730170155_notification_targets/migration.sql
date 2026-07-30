-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "notifyEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notifyOnBooking" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnCancel" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnMessage" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyWhatsapp" TEXT NOT NULL DEFAULT '';
