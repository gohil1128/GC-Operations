-- CreateTable
CREATE TABLE "SquareConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "connectedById" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "squareLocationIds" TEXT[],
    "squareLocations" JSONB NOT NULL,
    "timezone" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "statusNote" TEXT,
    "syncedThroughDay" TEXT NOT NULL,
    "runningSince" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquareConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SquareConnection_businessId_key" ON "SquareConnection"("businessId");

-- AddForeignKey
ALTER TABLE "SquareConnection" ADD CONSTRAINT "SquareConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquareConnection" ADD CONSTRAINT "SquareConnection_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquareConnection" ADD CONSTRAINT "SquareConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
