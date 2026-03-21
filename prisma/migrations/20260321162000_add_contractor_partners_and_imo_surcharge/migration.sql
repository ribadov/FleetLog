-- AlterTable
ALTER TABLE "Transport" ADD COLUMN "jobNumber" TEXT;
ALTER TABLE "Transport" ADD COLUMN "imoSurcharge" REAL NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ContractorPartnerAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractorId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractorPartnerAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractorPartnerAssignment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractorPartnerAssignment_contractorId_managerId_key" ON "ContractorPartnerAssignment"("contractorId", "managerId");
CREATE INDEX "ContractorPartnerAssignment_contractorId_idx" ON "ContractorPartnerAssignment"("contractorId");
CREATE INDEX "ContractorPartnerAssignment_managerId_idx" ON "ContractorPartnerAssignment"("managerId");
