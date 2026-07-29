-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "weeklyDiscountNights" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "weeklyDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 10;
