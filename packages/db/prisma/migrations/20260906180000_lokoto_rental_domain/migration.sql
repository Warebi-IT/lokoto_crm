-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'MOTORCYCLE', 'SCOOTER', 'TRUCK', 'MINIBUS');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE', 'STOLEN');

-- CreateEnum
CREATE TYPE "RentalContractStatus" AS ENUM ('DRAFT', 'RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentalChannel" AS ENUM ('AGENT', 'ONLINE');

-- CreateEnum
CREATE TYPE "FuelLevel" AS ENUM ('FULL', 'THREE_QUARTER', 'HALF', 'QUARTER', 'EMPTY');

-- CreateEnum
CREATE TYPE "DepositMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'CARD', 'NONE');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('HELD', 'PARTIALLY_RETURNED', 'RETURNED', 'FORFEITED');

-- CreateEnum
CREATE TYPE "DriverRole" AS ENUM ('PRIMARY', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('RENTAL_FEE', 'DEPOSIT', 'DEPOSIT_REFUND', 'EXTRA_FEE', 'PENALTY', 'MAINTENANCE_CHARGE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'WAVE', 'ORANGE_MONEY', 'CARD', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('ACCIDENT', 'THEFT', 'BREAKDOWN', 'DAMAGE', 'TRAFFIC_VIOLATION');

-- CreateEnum
CREATE TYPE "ResponsibleParty" AS ENUM ('CLIENT', 'AGENCY', 'THIRD_PARTY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InsuranceClaimStatus" AS ENUM ('NOT_FILED', 'FILED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('SCHEDULED', 'REPAIR');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('CHECK_OUT', 'CHECK_IN');

-- AlterEnum
BEGIN;
CREATE TYPE "FieldEntity_new" AS ENUM ('COMPANY', 'CONTACT', 'VEHICLE', 'RENTAL_CONTRACT');
ALTER TABLE "fieldDefinition" ALTER COLUMN "entity" TYPE "FieldEntity_new" USING ("entity"::text::"FieldEntity_new");
ALTER TYPE "FieldEntity" RENAME TO "FieldEntity_old";
ALTER TYPE "FieldEntity_new" RENAME TO "FieldEntity";
DROP TYPE "public"."FieldEntity_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "activity" DROP CONSTRAINT "activity_dealId_fkey";

-- DropForeignKey
ALTER TABLE "agentConversation" DROP CONSTRAINT "agentConversation_dealId_fkey";

-- DropForeignKey
ALTER TABLE "deal" DROP CONSTRAINT "deal_companyId_fkey";

-- DropForeignKey
ALTER TABLE "deal" DROP CONSTRAINT "deal_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "dealContact" DROP CONSTRAINT "dealContact_contactId_fkey";

-- DropForeignKey
ALTER TABLE "dealContact" DROP CONSTRAINT "dealContact_dealId_fkey";

-- DropForeignKey
ALTER TABLE "fieldValue" DROP CONSTRAINT "fieldValue_dealId_fkey";

-- DropIndex
DROP INDEX "activity_dealId_createdAt_idx";

-- DropIndex
DROP INDEX "agentConversation_dealId_lastMessageAt_idx";

-- DropIndex
DROP INDEX "fieldValue_dealId_idx";

-- DropIndex
DROP INDEX "fieldValue_fieldId_dealId_key";

-- AlterTable
ALTER TABLE "activity" DROP COLUMN "dealId",
ADD COLUMN     "rentalContractId" TEXT,
ADD COLUMN     "vehicleId" TEXT;

-- AlterTable
ALTER TABLE "agentConversation" DROP COLUMN "dealId",
ADD COLUMN     "rentalContractId" TEXT,
ADD COLUMN     "vehicleId" TEXT;

-- AlterTable
ALTER TABLE "fieldValue" DROP COLUMN "dealId",
ADD COLUMN     "rentalContractId" TEXT,
ADD COLUMN     "vehicleId" TEXT;

-- DropTable
DROP TABLE "deal";

-- DropTable
DROP TABLE "dealContact";

-- DropEnum
DROP TYPE "DealStage";

-- CreateTable
CREATE TABLE "vehicle" (
    "id" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "plateNumber" TEXT NOT NULL,
    "vin" TEXT,
    "color" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "dailyRate" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "baseAmount" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "fxRate" DECIMAL(20,10),
    "fxRateAt" TIMESTAMP(3),
    "mileage" INTEGER NOT NULL DEFAULT 0,
    "insurancePolicyNumber" TEXT,
    "insuranceExpiresAt" TIMESTAMP(3),
    "registrationExpiresAt" TIMESTAMP(3),
    "nextMaintenanceAtKm" INTEGER,
    "nextMaintenanceAtDate" TIMESTAMP(3),
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownerId" TEXT NOT NULL,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rentalContract" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "RentalContractStatus" NOT NULL DEFAULT 'DRAFT',
    "channel" "RentalChannel" NOT NULL DEFAULT 'AGENT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "actualPickupAt" TIMESTAMP(3),
    "actualReturnAt" TIMESTAMP(3),
    "pricePerDay" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "baseAmount" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "fxRate" DECIMAL(20,10),
    "fxRateAt" TIMESTAMP(3),
    "mileageIncludedPerDay" INTEGER,
    "extraMileageFeePerKm" DECIMAL(10,2),
    "mileageAtPickup" INTEGER,
    "mileageAtReturn" INTEGER,
    "fuelLevelAtPickup" "FuelLevel",
    "fuelLevelAtReturn" "FuelLevel",
    "depositAmount" DECIMAL(14,2) NOT NULL,
    "depositCurrency" TEXT NOT NULL DEFAULT 'USD',
    "depositMethod" "DepositMethod" NOT NULL DEFAULT 'NONE',
    "depositStatus" "DepositStatus" NOT NULL DEFAULT 'HELD',
    "depositReturnedAmount" DECIMAL(14,2),
    "depositReturnedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "contractDocumentUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "notes" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rentalContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rentalContractDriver" (
    "contractId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "DriverRole" NOT NULL DEFAULT 'ADDITIONAL',

    CONSTRAINT "rentalContractDriver_pkey" PRIMARY KEY ("contractId","contactId")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "rentalContractId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "baseAmount" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "fxRate" DECIMAL(20,10),
    "fxRateAt" TIMESTAMP(3),
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "rentalContractId" TEXT,
    "type" "IncidentType" NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedById" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleParty" "ResponsibleParty" NOT NULL DEFAULT 'UNKNOWN',
    "insuranceClaimNumber" TEXT,
    "insuranceStatus" "InsuranceClaimStatus" NOT NULL DEFAULT 'NOT_FILED',
    "estimatedCost" DECIMAL(14,2),
    "actualCost" DECIMAL(14,2),
    "currency" TEXT,
    "policeReportReference" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenanceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "description" TEXT NOT NULL,
    "scheduledAtKm" INTEGER,
    "scheduledAtDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "odometerAtService" INTEGER,
    "mechanic" TEXT,
    "cost" DECIMAL(14,2),
    "currency" TEXT,
    "invoiceReference" TEXT,
    "blocksAvailability" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicleInspection" (
    "id" TEXT NOT NULL,
    "rentalContractId" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "odometer" INTEGER NOT NULL,
    "fuelLevel" "FuelLevel" NOT NULL,
    "damageNotes" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inspectedById" TEXT NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicleInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_plateNumber_key" ON "vehicle"("plateNumber");

-- CreateIndex
CREATE INDEX "vehicle_ownerId_idx" ON "vehicle"("ownerId");

-- CreateIndex
CREATE INDEX "vehicle_status_idx" ON "vehicle"("status");

-- CreateIndex
CREATE INDEX "vehicle_type_idx" ON "vehicle"("type");

-- CreateIndex
CREATE INDEX "vehicle_lastActivityAt_idx" ON "vehicle"("lastActivityAt");

-- CreateIndex
CREATE INDEX "vehicle_baseAmount_idx" ON "vehicle"("baseAmount");

-- CreateIndex
CREATE INDEX "vehicle_currency_idx" ON "vehicle"("currency");

-- CreateIndex
CREATE INDEX "vehicle_nextMaintenanceAtDate_idx" ON "vehicle"("nextMaintenanceAtDate");

-- CreateIndex
CREATE INDEX "vehicle_insuranceExpiresAt_idx" ON "vehicle"("insuranceExpiresAt");

-- CreateIndex
CREATE INDEX "rentalContract_vehicleId_idx" ON "rentalContract"("vehicleId");

-- CreateIndex
CREATE INDEX "rentalContract_contactId_idx" ON "rentalContract"("contactId");

-- CreateIndex
CREATE INDEX "rentalContract_ownerId_idx" ON "rentalContract"("ownerId");

-- CreateIndex
CREATE INDEX "rentalContract_status_idx" ON "rentalContract"("status");

-- CreateIndex
CREATE INDEX "rentalContract_startDate_idx" ON "rentalContract"("startDate");

-- CreateIndex
CREATE INDEX "rentalContract_endDate_idx" ON "rentalContract"("endDate");

-- CreateIndex
CREATE INDEX "rentalContract_lastActivityAt_idx" ON "rentalContract"("lastActivityAt");

-- CreateIndex
CREATE INDEX "rentalContract_baseAmount_idx" ON "rentalContract"("baseAmount");

-- CreateIndex
CREATE INDEX "rentalContract_currency_idx" ON "rentalContract"("currency");

-- CreateIndex
CREATE INDEX "rentalContract_channel_idx" ON "rentalContract"("channel");

-- CreateIndex
CREATE INDEX "rentalContractDriver_contactId_idx" ON "rentalContractDriver"("contactId");

-- CreateIndex
CREATE INDEX "payment_rentalContractId_idx" ON "payment"("rentalContractId");

-- CreateIndex
CREATE INDEX "payment_type_idx" ON "payment"("type");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "payment"("status");

-- CreateIndex
CREATE INDEX "payment_paidAt_idx" ON "payment"("paidAt");

-- CreateIndex
CREATE INDEX "incident_vehicleId_idx" ON "incident"("vehicleId");

-- CreateIndex
CREATE INDEX "incident_rentalContractId_idx" ON "incident"("rentalContractId");

-- CreateIndex
CREATE INDEX "incident_type_idx" ON "incident"("type");

-- CreateIndex
CREATE INDEX "incident_insuranceStatus_idx" ON "incident"("insuranceStatus");

-- CreateIndex
CREATE INDEX "incident_reportedAt_idx" ON "incident"("reportedAt");

-- CreateIndex
CREATE INDEX "maintenanceRecord_vehicleId_idx" ON "maintenanceRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "maintenanceRecord_scheduledAtDate_idx" ON "maintenanceRecord"("scheduledAtDate");

-- CreateIndex
CREATE INDEX "maintenanceRecord_completedAt_idx" ON "maintenanceRecord"("completedAt");

-- CreateIndex
CREATE INDEX "vehicleInspection_rentalContractId_idx" ON "vehicleInspection"("rentalContractId");

-- CreateIndex
CREATE INDEX "vehicleInspection_type_idx" ON "vehicleInspection"("type");

-- CreateIndex
CREATE INDEX "activity_vehicleId_createdAt_idx" ON "activity"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_rentalContractId_createdAt_idx" ON "activity"("rentalContractId", "createdAt");

-- CreateIndex
CREATE INDEX "agentConversation_vehicleId_lastMessageAt_idx" ON "agentConversation"("vehicleId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "agentConversation_rentalContractId_lastMessageAt_idx" ON "agentConversation"("rentalContractId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "fieldValue_vehicleId_idx" ON "fieldValue"("vehicleId");

-- CreateIndex
CREATE INDEX "fieldValue_rentalContractId_idx" ON "fieldValue"("rentalContractId");

-- CreateIndex
CREATE UNIQUE INDEX "fieldValue_fieldId_vehicleId_key" ON "fieldValue"("fieldId", "vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "fieldValue_fieldId_rentalContractId_key" ON "fieldValue"("fieldId", "rentalContractId");

-- AddForeignKey
ALTER TABLE "agentConversation" ADD CONSTRAINT "agentConversation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentConversation" ADD CONSTRAINT "agentConversation_rentalContractId_fkey" FOREIGN KEY ("rentalContractId") REFERENCES "rentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentalContract" ADD CONSTRAINT "rentalContract_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentalContract" ADD CONSTRAINT "rentalContract_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentalContract" ADD CONSTRAINT "rentalContract_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentalContractDriver" ADD CONSTRAINT "rentalContractDriver_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "rentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentalContractDriver" ADD CONSTRAINT "rentalContractDriver_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_rentalContractId_fkey" FOREIGN KEY ("rentalContractId") REFERENCES "rentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_rentalContractId_fkey" FOREIGN KEY ("rentalContractId") REFERENCES "rentalContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenanceRecord" ADD CONSTRAINT "maintenanceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicleInspection" ADD CONSTRAINT "vehicleInspection_rentalContractId_fkey" FOREIGN KEY ("rentalContractId") REFERENCES "rentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicleInspection" ADD CONSTRAINT "vehicleInspection_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fieldValue" ADD CONSTRAINT "fieldValue_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fieldValue" ADD CONSTRAINT "fieldValue_rentalContractId_fkey" FOREIGN KEY ("rentalContractId") REFERENCES "rentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_rentalContractId_fkey" FOREIGN KEY ("rentalContractId") REFERENCES "rentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

