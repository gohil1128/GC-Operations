-- Which recipe a sold item is made from.
--
-- Square sends an item name and nothing else, so nothing sold could be costed
-- until somebody says "Masala Chai (12oz) is this recipe" once. Keyed on the
-- name rather than stored against SalesItem rows: every CSV import writes new
-- rows, so a per-row link would be lost each time the operator uploaded one.
CREATE TABLE "ItemRecipeLink" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemRecipeLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ItemRecipeLink_locationId_itemName_key" ON "ItemRecipeLink"("locationId", "itemName");
CREATE INDEX "ItemRecipeLink_recipeId_idx" ON "ItemRecipeLink"("recipeId");

ALTER TABLE "ItemRecipeLink" ADD CONSTRAINT "ItemRecipeLink_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemRecipeLink" ADD CONSTRAINT "ItemRecipeLink_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
