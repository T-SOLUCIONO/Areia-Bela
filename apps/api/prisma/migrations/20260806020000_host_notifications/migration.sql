-- Telegram como canal de aviso, y un interruptor para los cambios de reserva.
--
-- `notifyTelegram` guarda un chat id, no un teléfono: sale de `getUpdates`
-- después de que la anfitriona escriba una vez al bot, que es también lo que
-- autoriza al bot a responderle.
--
-- Ambas con valor por defecto para que la fila existente de SiteSettings no
-- necesite tocarse: sin chat id no hay destino de Telegram, y los cambios se
-- avisan salvo que se apaguen.

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "notifyTelegram" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notifyOnChange" BOOLEAN NOT NULL DEFAULT true;
