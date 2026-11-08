-- Owner switch for AI invoice reading (Gmail). On by default, as before.
ALTER TABLE "Business" ADD COLUMN "aiScanningEnabled" BOOLEAN NOT NULL DEFAULT true;
