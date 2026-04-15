ALTER TABLE "CallSession" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "CallSession" ADD COLUMN IF NOT EXISTS "recurrenceRule" TEXT;
ALTER TABLE "CallSession" ADD COLUMN IF NOT EXISTS "recurrenceParentId" TEXT;

CREATE INDEX IF NOT EXISTS "CallSession_scheduledAt_idx" ON "CallSession"("scheduledAt");
