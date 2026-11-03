-- The recipes PIN becomes a general section PIN: one PIN, a list of which
-- sections sit behind it. Renaming preserves the existing hash rather than
-- forcing every business to set a new one.
ALTER TABLE "Business" RENAME COLUMN "recipesPinHash" TO "sectionPinHash";

ALTER TABLE "Business" ADD COLUMN "lockedSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Anyone who already had a PIN was locking recipes with it. Carry that over so
-- the migration does not quietly unlock a section that was protected before.
UPDATE "Business" SET "lockedSections" = ARRAY['RECIPES'] WHERE "sectionPinHash" IS NOT NULL;
