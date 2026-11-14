-- History of Square syncs, for the list in Settings (counts only).
CREATE TABLE "SquareSyncRun" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ordersRead" INTEGER NOT NULL DEFAULT 0,
    "daysWritten" INTEGER NOT NULL DEFAULT 0,
    "manualDaysKept" INTEGER NOT NULL DEFAULT 0,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "error" TEXT,
    CONSTRAINT "SquareSyncRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SquareSyncRun_connectionId_startedAt_idx" ON "SquareSyncRun"("connectionId", "startedAt");
ALTER TABLE "SquareSyncRun" ADD CONSTRAINT "SquareSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SquareConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
