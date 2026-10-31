-- Per-business Overview personalisation.
--
-- Empty default, which means "hide nothing" — every existing business keeps the
-- exact Overview it has today, and the feature is opt-in per business.
ALTER TABLE "Business"
  ADD COLUMN "hiddenOverviewCards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
