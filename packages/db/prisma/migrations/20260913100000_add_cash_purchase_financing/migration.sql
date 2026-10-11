ALTER TYPE "FinancingType" ADD VALUE 'PURCHASE';
ALTER TABLE "vehicleFinancing" ADD COLUMN "fiscalDepreciationRate" DECIMAL(6,3);
