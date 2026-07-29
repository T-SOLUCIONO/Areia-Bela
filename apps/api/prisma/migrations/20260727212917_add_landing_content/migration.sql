-- CreateEnum
CREATE TYPE "ContentSectionKey" AS ENUM ('HERO', 'FEATURES', 'AMENITIES', 'REVIEWS', 'LOCATION', 'DIRECT_BOOKING', 'HOST', 'FOOTER');

-- CreateEnum
CREATE TYPE "ContentItemKind" AS ENUM ('HERO_BADGE', 'FEATURE_CARD', 'AMENITY', 'LOCATION_HIGHLIGHT', 'HOST_STAT', 'REVIEW_RATING');

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "logoUrl" TEXT;

-- CreateTable
CREATE TABLE "ContentSection" (
    "id" TEXT NOT NULL,
    "key" "ContentSectionKey" NOT NULL,
    "eyebrowEs" TEXT NOT NULL DEFAULT '',
    "eyebrowEn" TEXT NOT NULL DEFAULT '',
    "titleEs" TEXT NOT NULL DEFAULT '',
    "titleEn" TEXT NOT NULL DEFAULT '',
    "subtitleEs" TEXT NOT NULL DEFAULT '',
    "subtitleEn" TEXT NOT NULL DEFAULT '',
    "bodyEs" TEXT NOT NULL DEFAULT '',
    "bodyEn" TEXT NOT NULL DEFAULT '',
    "ctaLabelEs" TEXT NOT NULL DEFAULT '',
    "ctaLabelEn" TEXT NOT NULL DEFAULT '',
    "ctaHref" TEXT NOT NULL DEFAULT '',
    "statValue" TEXT NOT NULL DEFAULT '',
    "statLabelEs" TEXT NOT NULL DEFAULT '',
    "statLabelEn" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "kind" "ContentItemKind" NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "labelEs" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "bodyEs" TEXT NOT NULL DEFAULT '',
    "bodyEn" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorPhotoUrl" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "textEs" TEXT NOT NULL,
    "textEn" TEXT NOT NULL,
    "stayedAtEs" TEXT NOT NULL DEFAULT '',
    "stayedAtEn" TEXT NOT NULL DEFAULT '',
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentSection_key_key" ON "ContentSection"("key");

-- CreateIndex
CREATE INDEX "ContentItem_sectionId_kind_sortOrder_idx" ON "ContentItem"("sectionId", "kind", "sortOrder");

-- CreateIndex
CREATE INDEX "Review_sortOrder_idx" ON "Review"("sortOrder");

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ContentSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
