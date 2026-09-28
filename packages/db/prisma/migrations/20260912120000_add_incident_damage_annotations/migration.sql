CREATE TYPE "IncidentDamageView" AS ENUM ('THREE_QUARTER', 'FRONT', 'REAR', 'LEFT_SIDE', 'RIGHT_SIDE', 'ROOF', 'INTERIOR');
CREATE TYPE "IncidentDamageType" AS ENUM ('SCRATCH', 'DENT', 'CRACK', 'BROKEN', 'MISSING', 'STAIN', 'OTHER');
CREATE TYPE "IncidentDamageSeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE');

CREATE TABLE "incidentDamageAnnotation" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "view" "IncidentDamageView" NOT NULL,
    "type" "IncidentDamageType" NOT NULL,
    "severity" "IncidentDamageSeverity" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "points" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "incidentDamageAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "incidentDamageAnnotation_incidentId_idx" ON "incidentDamageAnnotation"("incidentId");
ALTER TABLE "incidentDamageAnnotation" ADD CONSTRAINT "incidentDamageAnnotation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
