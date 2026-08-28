-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TransportLeg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequence" INTEGER NOT NULL,
    "fromPlace" TEXT NOT NULL,
    "toPlace" TEXT NOT NULL,
    "waitingFrom" TEXT,
    "waitingTo" TEXT,
    "isIMO" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" REAL NOT NULL DEFAULT 0,
    "waitingMinutes" INTEGER NOT NULL DEFAULT 0,
    "waitingSurcharge" REAL NOT NULL DEFAULT 0,
    "totalPrice" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "transportId" TEXT NOT NULL,
    CONSTRAINT "TransportLeg_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TransportLeg" ("basePrice", "createdAt", "fromPlace", "id", "sequence", "toPlace", "totalPrice", "transportId", "updatedAt", "waitingFrom", "waitingMinutes", "waitingSurcharge", "waitingTo") SELECT "basePrice", "createdAt", "fromPlace", "id", "sequence", "toPlace", "totalPrice", "transportId", "updatedAt", "waitingFrom", "waitingMinutes", "waitingSurcharge", "waitingTo" FROM "TransportLeg";
DROP TABLE "TransportLeg";
ALTER TABLE "new_TransportLeg" RENAME TO "TransportLeg";
CREATE INDEX "TransportLeg_transportId_sequence_idx" ON "TransportLeg"("transportId", "sequence");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
