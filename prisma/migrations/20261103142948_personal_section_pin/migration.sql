-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lockedSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sectionPinHash" TEXT;

-- The business-wide PIN is retired: sections are open to everyone by default,
-- and a PIN is now a personal, optional choice. Clear the old PINs and lists so
-- nothing is left locked behind a PIN nobody can see or change any more.
UPDATE "Business" SET "sectionPinHash" = NULL, "lockedSections" = ARRAY[]::TEXT[];
