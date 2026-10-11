INSERT INTO "organization" ("id", "name", "slug", "createdAt")
SELECT 'workspace', 'CRM', 'crm', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "organization" WHERE "id" = 'workspace')
  AND (
    EXISTS (SELECT 1 FROM "contact")
    OR EXISTS (SELECT 1 FROM "vehicle")
    OR EXISTS (SELECT 1 FROM "rentalContract")
    OR EXISTS (SELECT 1 FROM "agentDefinition")
    OR EXISTS (SELECT 1 FROM "agentConversation")
  );

DROP INDEX "calendarEvent_iCalUid_originalStartTime_key";
DROP INDEX "contact_email_key";
DROP INDEX "emailMessage_rfcMessageId_key";
DROP INDEX "emailThread_rootMessageId_key";
DROP INDEX "fieldDefinition_entity_key_key";
DROP INDEX "vehicle_plateNumber_key";

ALTER TABLE "contact" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vehicle" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "rentalContract" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "payment" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "incident" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "maintenanceRecord" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vehicleInspection" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vehicleCharge" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "fieldDefinition" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "activity" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "emailThread" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "emailMessage" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "calendarEvent" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "suppressedDomain" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "suppressedContact" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "agentDefinition" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "agentConversation" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "agentTask" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';

UPDATE "contact" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "vehicle" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "rentalContract" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "payment" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "incident" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "maintenanceRecord" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "vehicleInspection" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "vehicleCharge" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "fieldDefinition" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "activity" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "emailThread" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "emailMessage" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "calendarEvent" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "suppressedDomain" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "suppressedContact" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "agentDefinition" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "agentConversation" SET "organizationId" = 'workspace' WHERE "organizationId" = '';
UPDATE "agentTask" SET "organizationId" = 'workspace' WHERE "organizationId" = '';

ALTER TABLE "suppressedContact" DROP CONSTRAINT "suppressedContact_pkey",
  ADD CONSTRAINT "suppressedContact_pkey" PRIMARY KEY ("organizationId", "email");
ALTER TABLE "suppressedDomain" DROP CONSTRAINT "suppressedDomain_pkey",
  ADD CONSTRAINT "suppressedDomain_pkey" PRIMARY KEY ("organizationId", "domain");

ALTER TABLE "organization" ADD COLUMN "joinCode" TEXT;
UPDATE "organization"
SET "joinCode" = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
WHERE "joinCode" IS NULL;
CREATE UNIQUE INDEX "organization_joinCode_key" ON "organization"("joinCode");

UPDATE "appSetting" SET "id" = 'workspace' WHERE "id" = 'app'
  AND EXISTS (SELECT 1 FROM "organization" WHERE "id" = 'workspace');

CREATE INDEX "contact_organizationId_idx" ON "contact"("organizationId");
CREATE INDEX "vehicle_organizationId_idx" ON "vehicle"("organizationId");
CREATE INDEX "rentalContract_organizationId_idx" ON "rentalContract"("organizationId");
CREATE INDEX "payment_organizationId_idx" ON "payment"("organizationId");
CREATE INDEX "incident_organizationId_idx" ON "incident"("organizationId");
CREATE INDEX "maintenanceRecord_organizationId_idx" ON "maintenanceRecord"("organizationId");
CREATE INDEX "vehicleInspection_organizationId_idx" ON "vehicleInspection"("organizationId");
CREATE INDEX "vehicleCharge_organizationId_idx" ON "vehicleCharge"("organizationId");
CREATE INDEX "fieldDefinition_organizationId_idx" ON "fieldDefinition"("organizationId");
CREATE INDEX "activity_organizationId_idx" ON "activity"("organizationId");
CREATE INDEX "emailThread_organizationId_idx" ON "emailThread"("organizationId");
CREATE INDEX "emailMessage_organizationId_idx" ON "emailMessage"("organizationId");
CREATE INDEX "calendarEvent_organizationId_idx" ON "calendarEvent"("organizationId");
CREATE INDEX "suppressedDomain_organizationId_idx" ON "suppressedDomain"("organizationId");
CREATE INDEX "suppressedContact_organizationId_idx" ON "suppressedContact"("organizationId");
CREATE INDEX "agentDefinition_organizationId_idx" ON "agentDefinition"("organizationId");
CREATE INDEX "agentConversation_organizationId_idx" ON "agentConversation"("organizationId");
CREATE INDEX "agentTask_organizationId_idx" ON "agentTask"("organizationId");
CREATE UNIQUE INDEX "calendarEvent_organizationId_iCalUid_originalStartTime_key" ON "calendarEvent"("organizationId", "iCalUid", "originalStartTime");
CREATE UNIQUE INDEX "contact_organizationId_email_key" ON "contact"("organizationId", "email");
CREATE UNIQUE INDEX "emailMessage_organizationId_rfcMessageId_key" ON "emailMessage"("organizationId", "rfcMessageId");
CREATE UNIQUE INDEX "emailThread_organizationId_rootMessageId_key" ON "emailThread"("organizationId", "rootMessageId");
CREATE UNIQUE INDEX "fieldDefinition_organizationId_entity_key_key" ON "fieldDefinition"("organizationId", "entity", "key");
CREATE UNIQUE INDEX "vehicle_organizationId_plateNumber_key" ON "vehicle"("organizationId", "plateNumber");

ALTER TABLE "contact" ADD CONSTRAINT "contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rentalContract" ADD CONSTRAINT "rentalContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment" ADD CONSTRAINT "payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident" ADD CONSTRAINT "incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenanceRecord" ADD CONSTRAINT "maintenanceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicleInspection" ADD CONSTRAINT "vehicleInspection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicleCharge" ADD CONSTRAINT "vehicleCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fieldDefinition" ADD CONSTRAINT "fieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity" ADD CONSTRAINT "activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emailThread" ADD CONSTRAINT "emailThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emailMessage" ADD CONSTRAINT "emailMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendarEvent" ADD CONSTRAINT "calendarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suppressedDomain" ADD CONSTRAINT "suppressedDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suppressedContact" ADD CONSTRAINT "suppressedContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agentDefinition" ADD CONSTRAINT "agentDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agentConversation" ADD CONSTRAINT "agentConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agentTask" ADD CONSTRAINT "agentTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
