-- CreateEnum
CREATE TYPE "MailMessageStatus" AS ENUM ('LOGGED', 'NEEDS_REVIEW', 'DISMISSED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "MailConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "connectedById" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gmail',
    "accountEmail" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "statusNote" TEXT,
    "scannedThrough" TIMESTAMP(3) NOT NULL,
    "lastScanAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "gmailId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "MailMessageStatus" NOT NULL,
    "reason" TEXT,
    "confidence" DOUBLE PRECISION,
    "extracted" JSONB,
    "attachmentName" TEXT,
    "invoiceId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailScanRun" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "listed" INTEGER NOT NULL DEFAULT 0,
    "triaged" INTEGER NOT NULL DEFAULT 0,
    "logged" INTEGER NOT NULL DEFAULT 0,
    "queued" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,

    CONSTRAINT "MailScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierMailSender" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierMailSender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailConnection_businessId_key" ON "MailConnection"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_invoiceId_key" ON "MailMessage"("invoiceId");

-- CreateIndex
CREATE INDEX "MailMessage_connectionId_status_receivedAt_idx" ON "MailMessage"("connectionId", "status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_connectionId_gmailId_key" ON "MailMessage"("connectionId", "gmailId");

-- CreateIndex
CREATE INDEX "MailScanRun_connectionId_startedAt_idx" ON "MailScanRun"("connectionId", "startedAt");

-- CreateIndex
CREATE INDEX "SupplierMailSender_address_idx" ON "SupplierMailSender"("address");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierMailSender_supplierId_address_key" ON "SupplierMailSender"("supplierId", "address");

-- AddForeignKey
ALTER TABLE "MailConnection" ADD CONSTRAINT "MailConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailConnection" ADD CONSTRAINT "MailConnection_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailConnection" ADD CONSTRAINT "MailConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MailConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailScanRun" ADD CONSTRAINT "MailScanRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MailConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierMailSender" ADD CONSTRAINT "SupplierMailSender_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
