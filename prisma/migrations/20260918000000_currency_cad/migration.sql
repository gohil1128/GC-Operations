-- Currency: US dollars to Canadian dollars.
--
-- The app formatted every figure as en-US/USD while the business it was built
-- for trades in Canada. Both render "$1,234.56", so nothing looked wrong — the
-- amounts were simply labelled as the wrong currency everywhere it counts: to a
-- screen reader, in an exported CSV, and to any accounting package that reads
-- the label rather than the glyph.
--
-- Two halves, and the second is the one that is easy to forget: changing a
-- column DEFAULT does nothing to rows that already exist. Businesses and
-- vendors created before this would keep saying USD forever.

-- New rows.
ALTER TABLE "Business" ALTER COLUMN "currency" SET DEFAULT 'CAD';
ALTER TABLE "Vendor"   ALTER COLUMN "currency" SET DEFAULT 'CAD';

-- Existing rows. Only those still on the old default are touched: a vendor
-- deliberately set to GBP or EUR for an overseas supplier is left alone, since
-- that is a real fact about who they invoice in and not a leftover default.
UPDATE "Business" SET "currency" = 'CAD' WHERE "currency" = 'USD';
UPDATE "Vendor"   SET "currency" = 'CAD' WHERE "currency" = 'USD';
