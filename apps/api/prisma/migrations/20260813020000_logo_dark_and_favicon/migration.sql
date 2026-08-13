-- El logo en dos versiones y el favicon, editables desde el panel.
--
-- El logo que hay es tinta negra sobre fondo transparente, dibujado para una
-- página blanca: sobre la cabecera oscura el logotipo desaparece y solo queda
-- la estrella turquesa. En vez de aplanarlo a blanco con un filtro CSS —que se
-- lleva por delante el turquesa— la anfitriona sube el suyo.
--
-- Las dos columnas son opcionales: nulo significa «usa el que viene con la
-- web», no «no hay logo».

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN "logoDarkUrl" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "faviconUrl" TEXT;
