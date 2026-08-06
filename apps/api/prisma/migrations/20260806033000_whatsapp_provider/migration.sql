-- Elegir quién lleva el WhatsApp: Twilio o el Cloud API de Meta.
--
-- Por defecto TWILIO porque es lo que ya estaba configurado: una migración no
-- debe cambiar por dónde salen los avisos de nadie.

-- CreateEnum
CREATE TYPE "WhatsAppProvider" AS ENUM ('TWILIO', 'META');

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "whatsappProvider" "WhatsAppProvider" NOT NULL DEFAULT 'TWILIO';
