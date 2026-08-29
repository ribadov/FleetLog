-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DRIVER', 'CONTRACTOR', 'MANAGER');

-- CreateEnum
CREATE TYPE "ContainerSize" AS ENUM ('SIZE_20', 'SIZE_40', 'SIZE_45');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "preferredLanguage" TEXT,
    "billingEmail" TEXT,
    "invoiceEmailSubject" TEXT,
    "invoiceEmailBody" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DRIVER',
    "companyName" TEXT,
    "companyStreet" TEXT,
    "companyHouseNumber" TEXT,
    "companyPostalCode" TEXT,
    "companyCity" TEXT,
    "companyCountry" TEXT,
    "vatId" TEXT,
    "taxNumber" TEXT,
    "bankName" TEXT,
    "bankAccountHolder" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "logoPath" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "itemsCount" INTEGER NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractorId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "sentById" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transport" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "containerNumber" TEXT,
    "orderNumber" TEXT,
    "fromPlace" TEXT NOT NULL,
    "toPlace" TEXT NOT NULL,
    "containerSize" "ContainerSize" NOT NULL,
    "isIMO" BOOLEAN NOT NULL DEFAULT false,
    "waitingFrom" TEXT,
    "waitingTo" TEXT,
    "freightLetterPath" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waitingMinutes" INTEGER NOT NULL DEFAULT 0,
    "waitingSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imoSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT,
    "driverId" TEXT NOT NULL,
    "contractorId" TEXT,
    "sellerId" TEXT,
    "invoiceId" TEXT,

    CONSTRAINT "Transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorPartnerAssignment" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorPartnerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportLeg" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "fromPlace" TEXT NOT NULL,
    "toPlace" TEXT NOT NULL,
    "waitingFrom" TEXT,
    "waitingTo" TEXT,
    "isIMO" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waitingMinutes" INTEGER NOT NULL DEFAULT 0,
    "waitingSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transportId" TEXT NOT NULL,

    CONSTRAINT "TransportLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_code_key" ON "Workspace"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "ContractorPartnerAssignment_contractorId_idx" ON "ContractorPartnerAssignment"("contractorId");

-- CreateIndex
CREATE INDEX "ContractorPartnerAssignment_managerId_idx" ON "ContractorPartnerAssignment"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorPartnerAssignment_contractorId_managerId_key" ON "ContractorPartnerAssignment"("contractorId", "managerId");

-- CreateIndex
CREATE INDEX "TransportLeg_transportId_sequence_idx" ON "TransportLeg"("transportId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Place_workspaceId_name_key" ON "Place"("workspaceId", "name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_email_fkey" FOREIGN KEY ("email") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorPartnerAssignment" ADD CONSTRAINT "ContractorPartnerAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorPartnerAssignment" ADD CONSTRAINT "ContractorPartnerAssignment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLeg" ADD CONSTRAINT "TransportLeg_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
