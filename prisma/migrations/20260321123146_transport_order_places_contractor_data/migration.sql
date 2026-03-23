-- AlterTable
ALTER TABLE "Transport" ADD COLUMN "freightLetterPath" TEXT;
ALTER TABLE "Transport" ADD COLUMN "orderNumber" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "companyCity" TEXT;
ALTER TABLE "User" ADD COLUMN "companyCountry" TEXT;
ALTER TABLE "User" ADD COLUMN "companyHouseNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "companyName" TEXT;
ALTER TABLE "User" ADD COLUMN "companyPostalCode" TEXT;
ALTER TABLE "User" ADD COLUMN "companyStreet" TEXT;
ALTER TABLE "User" ADD COLUMN "taxNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "vatId" TEXT;

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Place_name_key" ON "Place"("name");
