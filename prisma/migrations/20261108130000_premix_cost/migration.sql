-- What a bag of premix costs to make in house (default $6.00).
ALTER TABLE "Business" ADD COLUMN "premixCostCents" INTEGER NOT NULL DEFAULT 600;
