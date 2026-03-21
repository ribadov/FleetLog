-- AlterTable
ALTER TABLE "Transport" ADD COLUMN "basePrice" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Transport" ADD COLUMN "waitingMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Transport" ADD COLUMN "waitingSurcharge" REAL NOT NULL DEFAULT 0;

-- Backfill basePrice for existing records
UPDATE "Transport"
SET "basePrice" = "price"
WHERE "basePrice" = 0;

-- CreateTable
CREATE TABLE "TransportLeg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequence" INTEGER NOT NULL,
    "fromPlace" TEXT NOT NULL,
    "toPlace" TEXT NOT NULL,
    "waitingFrom" TEXT,
    "waitingTo" TEXT,
    "basePrice" REAL NOT NULL DEFAULT 0,
    "waitingMinutes" INTEGER NOT NULL DEFAULT 0,
    "waitingSurcharge" REAL NOT NULL DEFAULT 0,
    "totalPrice" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "transportId" TEXT NOT NULL,
    CONSTRAINT "TransportLeg_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TransportLeg_transportId_sequence_idx" ON "TransportLeg"("transportId", "sequence");
