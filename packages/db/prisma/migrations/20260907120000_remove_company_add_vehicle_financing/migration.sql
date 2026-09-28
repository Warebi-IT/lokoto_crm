-- CreateEnum
CREATE TYPE "FinancingType" AS ENUM ('LOAN', 'LEASING');

-- CreateEnum
CREATE TYPE "ChargeFrequency" AS ENUM ('ONE_TIME', 'MONTHLY');

-- AlterEnum
BEGIN;
CREATE TYPE "FieldEntity_new" AS ENUM ('CONTACT', 'VEHICLE', 'RENTAL_CONTRACT');
ALTER TABLE "fieldDefinition" ALTER COLUMN "entity" TYPE "FieldEntity_new" USING ("entity"::text::"FieldEntity_new");
ALTER TYPE "FieldEntity" RENAME TO "FieldEntity_old";
ALTER TYPE "FieldEntity_new" RENAME TO "FieldEntity";
DROP TYPE "public"."FieldEntity_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "activity" DROP CONSTRAINT "activity_companyId_fkey";

-- DropForeignKey
ALTER TABLE "agentConversation" DROP CONSTRAINT "agentConversation_companyId_fkey";

-- DropForeignKey
ALTER TABLE "calendarEvent" DROP CONSTRAINT "calendarEvent_companyId_fkey";

-- DropForeignKey
ALTER TABLE "company" DROP CONSTRAINT "company_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "company" DROP CONSTRAINT "company_primaryContactId_fkey";

-- DropForeignKey
ALTER TABLE "companyEnrichment" DROP CONSTRAINT "companyEnrichment_companyId_fkey";

-- DropForeignKey
ALTER TABLE "contact" DROP CONSTRAINT "contact_companyId_fkey";

-- DropForeignKey
ALTER TABLE "emailThread" DROP CONSTRAINT "emailThread_companyId_fkey";

-- DropForeignKey
ALTER TABLE "fieldValue" DROP CONSTRAINT "fieldValue_companyId_fkey";

-- DropIndex
DROP INDEX "activity_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "agentConversation_companyId_lastMessageAt_idx";

-- DropIndex
DROP INDEX "calendarEvent_companyId_startsAt_idx";

-- DropIndex
DROP INDEX "contact_companyId_idx";

-- DropIndex
DROP INDEX "emailThread_companyId_lastMessageAt_idx";

-- DropIndex
DROP INDEX "fieldValue_companyId_idx";

-- DropIndex
DROP INDEX "fieldValue_fieldId_companyId_key";

-- AlterTable
ALTER TABLE "activity" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "agentConversation" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "agentTask" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "calendarEvent" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "contact" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "emailThread" DROP COLUMN "companyId";

-- AlterTable
ALTER TABLE "fieldValue" DROP COLUMN "companyId";

-- DropTable
DROP TABLE "company";

-- DropTable
DROP TABLE "companyEnrichment";

-- CreateTable
CREATE TABLE "vehicleFinancing" (
    "vehicleId" TEXT NOT NULL,
    "type" "FinancingType" NOT NULL,
    "principalAmount" DECIMAL(14,2),
    "monthlyPayment" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "baseAmount" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "fxRate" DECIMAL(20,10),
    "fxRateAt" TIMESTAMP(3),
    "interestRate" DECIMAL(6,3),
    "termMonths" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicleFinancing_pkey" PRIMARY KEY ("vehicleId")
);

-- CreateTable
CREATE TABLE "vehicleCharge" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "baseAmount" DECIMAL(24,4),
    "baseCurrency" TEXT,
    "fxRate" DECIMAL(20,10),
    "fxRateAt" TIMESTAMP(3),
    "frequency" "ChargeFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicleCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicleCharge_vehicleId_idx" ON "vehicleCharge"("vehicleId");

-- AddForeignKey
ALTER TABLE "vehicleFinancing" ADD CONSTRAINT "vehicleFinancing_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicleCharge" ADD CONSTRAINT "vehicleCharge_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

