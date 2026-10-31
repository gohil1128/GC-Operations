-- Cash taken out of the drawer during the day, itemised: who took it, what
-- for, and how much. CashClose.paidOutCents already existed but was a number
-- somebody typed and, worse, one the over/short arithmetic ignored entirely --
-- so reimbursing a barista $18 out of the till read as an $18 shortage.
CREATE TYPE "PayoutKind" AS ENUM ('REIMBURSEMENT', 'SUPPLIER', 'OTHER');

CREATE TABLE "CashPayout" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "kind" "PayoutKind" NOT NULL DEFAULT 'REIMBURSEMENT',
    "reason" TEXT NOT NULL,
    "paidTo" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashPayout_locationId_businessDate_idx" ON "CashPayout"("locationId", "businessDate");

ALTER TABLE "CashPayout" ADD CONSTRAINT "CashPayout_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
