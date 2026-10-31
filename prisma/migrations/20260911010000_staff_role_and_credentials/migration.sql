-- A third role, below MANAGER: staff who record cash closes and inventory
-- counts but see none of the money. Only the value is added here and nothing
-- references it yet, which is what keeps this safe to run inside Prisma's
-- migration transaction (Postgres forbids USING a new enum value in the same
-- transaction that adds it, not adding one).
ALTER TYPE "Role" ADD VALUE 'STAFF';

-- Marks an account that is still on a password somebody else chose. Existing
-- accounts default to false: they are already on passwords their owners picked,
-- and flipping them true would lock everyone out of their own app on deploy.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Single-use, expiring password resets. Only the token's hash is stored, for
-- the same reason passwords are hashed: read access to this table must not be
-- enough to take over an account. The raw token exists only inside the link.
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
