ALTER TABLE "member" ADD COLUMN "agentEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "member" SET "agentEnabled" = true WHERE "role" = 'owner';

ALTER TABLE "appSetting"
  ADD COLUMN "agentInputPricePerMillion" DECIMAL(12,6),
  ADD COLUMN "agentOutputPricePerMillion" DECIMAL(12,6);

CREATE TABLE "agentUsage" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "model" TEXT,
  "inputTokens" INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "totalTokens" INTEGER NOT NULL,
  "inputPricePerMillion" DECIMAL(12,6) NOT NULL,
  "outputPricePerMillion" DECIMAL(12,6) NOT NULL,
  "costUsd" DECIMAL(14,8) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agentUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agentUsage_eventId_key" ON "agentUsage"("eventId");
CREATE INDEX "agentUsage_userId_createdAt_idx" ON "agentUsage"("userId", "createdAt");
CREATE INDEX "agentUsage_sessionId_idx" ON "agentUsage"("sessionId");
CREATE INDEX "agentUsage_createdAt_idx" ON "agentUsage"("createdAt");

CREATE TABLE "agentUsageMonthly" (
  "month" DATE NOT NULL,
  "userId" TEXT NOT NULL DEFAULT '',
  "requests" INTEGER NOT NULL DEFAULT 0,
  "inputTokens" BIGINT NOT NULL DEFAULT 0,
  "outputTokens" BIGINT NOT NULL DEFAULT 0,
  "totalTokens" BIGINT NOT NULL DEFAULT 0,
  "costUsd" DECIMAL(14,8) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agentUsageMonthly_pkey" PRIMARY KEY ("month", "userId")
);
