-- CreateEnum
CREATE TYPE "CMSPageSlug" AS ENUM ('ABOUT_SPACE', 'ACCOMMODATION', 'LIVING_AREAS', 'KITCHEN_DINING', 'BEDROOMS_BATHROOMS', 'OUTDOOR_LIFE', 'AMENITIES', 'LOCATION', 'GUEST_ACCESS', 'HOUSE_RULES', 'FAQS', 'POLICIES');

-- CreateEnum
CREATE TYPE "FAQCategory" AS ENUM ('PETS', 'TRASH', 'POOL', 'PARTIES', 'GENERAL');

-- CreateTable
CREATE TABLE "CMSPage" (
    "id" TEXT NOT NULL,
    "slug" "CMSPageSlug" NOT NULL,
    "titleEs" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyEs" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CMSPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAQ" (
    "id" TEXT NOT NULL,
    "questionEs" TEXT NOT NULL,
    "questionEn" TEXT NOT NULL,
    "answerEs" TEXT NOT NULL,
    "answerEn" TEXT NOT NULL,
    "category" "FAQCategory" NOT NULL DEFAULT 'GENERAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FAQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altEs" TEXT NOT NULL,
    "altEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'site',
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "seoTitleEs" TEXT NOT NULL,
    "seoTitleEn" TEXT NOT NULL,
    "seoDescriptionEs" TEXT NOT NULL,
    "seoDescriptionEn" TEXT NOT NULL,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "airbnbUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CMSPage_slug_key" ON "CMSPage"("slug");

-- CreateIndex
CREATE INDEX "FAQ_category_sortOrder_idx" ON "FAQ"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "GalleryImage_sortOrder_idx" ON "GalleryImage"("sortOrder");
