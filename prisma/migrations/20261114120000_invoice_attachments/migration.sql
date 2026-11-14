-- Further pages attached to an invoice (the first stays in Invoice.imageDataUrl).
CREATE TABLE "InvoiceAttachment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoiceAttachment_invoiceId_createdAt_idx" ON "InvoiceAttachment"("invoiceId", "createdAt");
ALTER TABLE "InvoiceAttachment" ADD CONSTRAINT "InvoiceAttachment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
