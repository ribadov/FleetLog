-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "itemsCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "contractorId" TEXT NOT NULL,
    CONSTRAINT "Invoice_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "fromPlace" TEXT NOT NULL,
    "toPlace" TEXT NOT NULL,
    "containerSize" TEXT NOT NULL,
    "isIMO" BOOLEAN NOT NULL DEFAULT false,
    "waitingFrom" TEXT,
    "waitingTo" TEXT,
    "price" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "driverId" TEXT NOT NULL,
    "contractorId" TEXT,
    "sellerId" TEXT,
    "invoiceId" TEXT,
    CONSTRAINT "Transport_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transport_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transport_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transport_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transport" ("containerSize", "contractorId", "createdAt", "date", "driverId", "fromPlace", "id", "isIMO", "notes", "price", "sellerId", "toPlace", "updatedAt", "waitingFrom", "waitingTo") SELECT "containerSize", "contractorId", "createdAt", "date", "driverId", "fromPlace", "id", "isIMO", "notes", "price", "sellerId", "toPlace", "updatedAt", "waitingFrom", "waitingTo" FROM "Transport";
DROP TABLE "Transport";
ALTER TABLE "new_Transport" RENAME TO "Transport";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
