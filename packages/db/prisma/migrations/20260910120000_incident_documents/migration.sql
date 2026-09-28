CREATE TYPE "IncidentDepositOutcome" AS ENUM ('NONE', 'PARTIAL', 'FULL');

CREATE TYPE "IncidentDocumentType" AS ENUM ('PHOTO', 'POLICE_REPORT', 'INVOICE', 'OTHER');

ALTER TABLE "incident"
ADD COLUMN "depositOutcome" "IncidentDepositOutcome" NOT NULL DEFAULT 'NONE',
ADD COLUMN "depositDeductedAmount" DECIMAL(14,2),
ADD COLUMN "depositCurrency" TEXT;

CREATE TABLE "incidentDocument" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" "IncidentDocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "contentType" TEXT,
    "amount" DECIMAL(14,2),
    "currency" TEXT,
    "insuranceReimbursedAmount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidentDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "incidentDocument_incidentId_idx" ON "incidentDocument"("incidentId");

ALTER TABLE "incidentDocument" ADD CONSTRAINT "incidentDocument_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
