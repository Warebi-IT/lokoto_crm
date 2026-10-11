ALTER TABLE "vehicleFinancing" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';

UPDATE "vehicleFinancing" f
SET "organizationId" = v."organizationId"
FROM "vehicle" v
WHERE f."vehicleId" = v.id;

CREATE INDEX "vehicleFinancing_organizationId_idx" ON "vehicleFinancing"("organizationId");

ALTER TABLE "vehicleFinancing" ADD CONSTRAINT "vehicleFinancing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
