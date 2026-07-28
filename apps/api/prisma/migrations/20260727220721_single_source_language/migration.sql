-- Single source language + a Translation table.
--
-- Content used to live in two columns per field ("…Es"/"…En"). This renames the
-- Spanish column to the bare field name — it becomes the one authored copy —
-- and moves the English text into Translation rows before dropping the column,
-- so nothing already written is lost.

CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "isMachine" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Translation_entity_entityId_field_locale_key"
    ON "Translation"("entity", "entityId", "field", "locale");
CREATE INDEX "Translation_entity_entityId_locale_idx"
    ON "Translation"("entity", "entityId", "locale");

-- Property
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'Property', "id", 'name', 'en', "nameEn",
       encode(sha256(convert_to("nameEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "Property"
WHERE "nameEn" IS NOT NULL AND btrim("nameEn") <> '' AND "nameEn" <> "nameEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'Property', "id", 'description', 'en', "descriptionEn",
       encode(sha256(convert_to("descriptionEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "Property"
WHERE "descriptionEn" IS NOT NULL AND btrim("descriptionEn") <> '' AND "descriptionEn" <> "descriptionEs";
ALTER TABLE "Property" RENAME COLUMN "nameEs" TO "name";
ALTER TABLE "Property" DROP COLUMN "nameEn";
ALTER TABLE "Property" RENAME COLUMN "descriptionEs" TO "description";
ALTER TABLE "Property" DROP COLUMN "descriptionEn";

-- Extra
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'Extra', "id", 'name', 'en', "nameEn",
       encode(sha256(convert_to("nameEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "Extra"
WHERE "nameEn" IS NOT NULL AND btrim("nameEn") <> '' AND "nameEn" <> "nameEs";
ALTER TABLE "Extra" RENAME COLUMN "nameEs" TO "name";
ALTER TABLE "Extra" DROP COLUMN "nameEn";

-- CMSPage
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'CMSPage', "id", 'title', 'en', "titleEn",
       encode(sha256(convert_to("titleEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "CMSPage"
WHERE "titleEn" IS NOT NULL AND btrim("titleEn") <> '' AND "titleEn" <> "titleEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'CMSPage', "id", 'body', 'en', "bodyEn",
       encode(sha256(convert_to("bodyEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "CMSPage"
WHERE "bodyEn" IS NOT NULL AND btrim("bodyEn") <> '' AND "bodyEn" <> "bodyEs";
ALTER TABLE "CMSPage" RENAME COLUMN "titleEs" TO "title";
ALTER TABLE "CMSPage" DROP COLUMN "titleEn";
ALTER TABLE "CMSPage" RENAME COLUMN "bodyEs" TO "body";
ALTER TABLE "CMSPage" DROP COLUMN "bodyEn";

-- FAQ
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'FAQ', "id", 'question', 'en', "questionEn",
       encode(sha256(convert_to("questionEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "FAQ"
WHERE "questionEn" IS NOT NULL AND btrim("questionEn") <> '' AND "questionEn" <> "questionEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'FAQ', "id", 'answer', 'en', "answerEn",
       encode(sha256(convert_to("answerEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "FAQ"
WHERE "answerEn" IS NOT NULL AND btrim("answerEn") <> '' AND "answerEn" <> "answerEs";
ALTER TABLE "FAQ" RENAME COLUMN "questionEs" TO "question";
ALTER TABLE "FAQ" DROP COLUMN "questionEn";
ALTER TABLE "FAQ" RENAME COLUMN "answerEs" TO "answer";
ALTER TABLE "FAQ" DROP COLUMN "answerEn";

-- GalleryImage
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'GalleryImage', "id", 'alt', 'en', "altEn",
       encode(sha256(convert_to("altEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "GalleryImage"
WHERE "altEn" IS NOT NULL AND btrim("altEn") <> '' AND "altEn" <> "altEs";
ALTER TABLE "GalleryImage" RENAME COLUMN "altEs" TO "alt";
ALTER TABLE "GalleryImage" DROP COLUMN "altEn";

-- SiteSettings
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'SiteSettings', "id", 'seoTitle', 'en', "seoTitleEn",
       encode(sha256(convert_to("seoTitleEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "SiteSettings"
WHERE "seoTitleEn" IS NOT NULL AND btrim("seoTitleEn") <> '' AND "seoTitleEn" <> "seoTitleEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'SiteSettings', "id", 'seoDescription', 'en', "seoDescriptionEn",
       encode(sha256(convert_to("seoDescriptionEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "SiteSettings"
WHERE "seoDescriptionEn" IS NOT NULL AND btrim("seoDescriptionEn") <> '' AND "seoDescriptionEn" <> "seoDescriptionEs";
ALTER TABLE "SiteSettings" RENAME COLUMN "seoTitleEs" TO "seoTitle";
ALTER TABLE "SiteSettings" DROP COLUMN "seoTitleEn";
ALTER TABLE "SiteSettings" RENAME COLUMN "seoDescriptionEs" TO "seoDescription";
ALTER TABLE "SiteSettings" DROP COLUMN "seoDescriptionEn";

-- ContentSection
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'ContentSection', "id", 'eyebrow', 'en', "eyebrowEn",
       encode(sha256(convert_to("eyebrowEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "ContentSection"
WHERE "eyebrowEn" IS NOT NULL AND btrim("eyebrowEn") <> '' AND "eyebrowEn" <> "eyebrowEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'ContentSection', "id", 'title', 'en', "titleEn",
       encode(sha256(convert_to("titleEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "ContentSection"
WHERE "titleEn" IS NOT NULL AND btrim("titleEn") <> '' AND "titleEn" <> "titleEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'ContentSection', "id", 'subtitle', 'en', "subtitleEn",
       encode(sha256(convert_to("subtitleEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "ContentSection"
WHERE "subtitleEn" IS NOT NULL AND btrim("subtitleEn") <> '' AND "subtitleEn" <> "subtitleEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'ContentSection', "id", 'body', 'en', "bodyEn",
       encode(sha256(convert_to("bodyEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "ContentSection"
WHERE "bodyEn" IS NOT NULL AND btrim("bodyEn") <> '' AND "bodyEn" <> "bodyEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'ContentSection', "id", 'ctaLabel', 'en', "ctaLabelEn",
       encode(sha256(convert_to("ctaLabelEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "ContentSection"
WHERE "ctaLabelEn" IS NOT NULL AND btrim("ctaLabelEn") <> '' AND "ctaLabelEn" <> "ctaLabelEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'ContentSection', "id", 'statLabel', 'en', "statLabelEn",
       encode(sha256(convert_to("statLabelEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "ContentSection"
WHERE "statLabelEn" IS NOT NULL AND btrim("statLabelEn") <> '' AND "statLabelEn" <> "statLabelEs";
ALTER TABLE "ContentSection" RENAME COLUMN "eyebrowEs" TO "eyebrow";
ALTER TABLE "ContentSection" DROP COLUMN "eyebrowEn";
ALTER TABLE "ContentSection" RENAME COLUMN "titleEs" TO "title";
ALTER TABLE "ContentSection" DROP COLUMN "titleEn";
ALTER TABLE "ContentSection" RENAME COLUMN "subtitleEs" TO "subtitle";
ALTER TABLE "ContentSection" DROP COLUMN "subtitleEn";
ALTER TABLE "ContentSection" RENAME COLUMN "bodyEs" TO "body";
ALTER TABLE "ContentSection" DROP COLUMN "bodyEn";
ALTER TABLE "ContentSection" RENAME COLUMN "ctaLabelEs" TO "ctaLabel";
ALTER TABLE "ContentSection" DROP COLUMN "ctaLabelEn";
ALTER TABLE "ContentSection" RENAME COLUMN "statLabelEs" TO "statLabel";
ALTER TABLE "ContentSection" DROP COLUMN "statLabelEn";

-- ContentItem
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'ContentItem', "id", 'label', 'en', "labelEn",
       encode(sha256(convert_to("labelEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "ContentItem"
WHERE "labelEn" IS NOT NULL AND btrim("labelEn") <> '' AND "labelEn" <> "labelEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'ContentItem', "id", 'body', 'en', "bodyEn",
       encode(sha256(convert_to("bodyEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "ContentItem"
WHERE "bodyEn" IS NOT NULL AND btrim("bodyEn") <> '' AND "bodyEn" <> "bodyEs";
ALTER TABLE "ContentItem" RENAME COLUMN "labelEs" TO "label";
ALTER TABLE "ContentItem" DROP COLUMN "labelEn";
ALTER TABLE "ContentItem" RENAME COLUMN "bodyEs" TO "body";
ALTER TABLE "ContentItem" DROP COLUMN "bodyEn";

-- Review
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'Review', "id", 'text', 'en', "textEn",
       encode(sha256(convert_to("textEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "Review"
WHERE "textEn" IS NOT NULL AND btrim("textEn") <> '' AND "textEn" <> "textEs";
INSERT INTO "Translation" ("id", "entity", "entityId", "field", "locale", "text", "sourceHash", "isMachine", "updatedAt")
SELECT gen_random_uuid()::text, 'Review', "id", 'stayedAt', 'en', "stayedAtEn",
       encode(sha256(convert_to("stayedAtEs", 'UTF8')), 'hex'), false, CURRENT_TIMESTAMP
FROM "Review"
WHERE "stayedAtEn" IS NOT NULL AND btrim("stayedAtEn") <> '' AND "stayedAtEn" <> "stayedAtEs";
ALTER TABLE "Review" RENAME COLUMN "textEs" TO "text";
ALTER TABLE "Review" DROP COLUMN "textEn";
ALTER TABLE "Review" RENAME COLUMN "stayedAtEs" TO "stayedAt";
ALTER TABLE "Review" DROP COLUMN "stayedAtEn";
