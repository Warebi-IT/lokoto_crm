CREATE TABLE "vehicleMileageEntry" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "contractId" TEXT,
    "mileage" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicleMileageEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rentalContractMileageRule" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "kilometers" INTEGER,
    "pricePerKm" DECIMAL(10,2) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rentalContractMileageRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "rentalContract" ADD COLUMN "extraMileageAmount" DECIMAL(14,2);

CREATE UNIQUE INDEX "vehicleMileageEntry_contractId_key" ON "vehicleMileageEntry"("contractId");
CREATE INDEX "vehicleMileageEntry_vehicleId_recordedAt_idx" ON "vehicleMileageEntry"("vehicleId", "recordedAt");
CREATE INDEX "rentalContractMileageRule_contractId_position_idx" ON "rentalContractMileageRule"("contractId", "position");

ALTER TABLE "vehicleMileageEntry" ADD CONSTRAINT "vehicleMileageEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicleMileageEntry" ADD CONSTRAINT "vehicleMileageEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "rentalContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rentalContractMileageRule" ADD CONSTRAINT "rentalContractMileageRule_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "rentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
