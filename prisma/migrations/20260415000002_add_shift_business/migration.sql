-- Add businessId to Shift
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "businessId" TEXT;

-- FK constraint
DO $$ BEGIN
  ALTER TABLE "Shift" ADD CONSTRAINT "Shift_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS "Shift_businessId_idx" ON "Shift"("businessId");
