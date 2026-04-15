-- Add new enum values to DisputeStatus
DO $$ BEGIN
  ALTER TYPE "DisputeStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "DisputeStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add TicketPriority enum
DO $$ BEGIN
  CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add TicketAssigneeType enum
DO $$ BEGIN
  CREATE TYPE "TicketAssigneeType" AS ENUM ('AGENT', 'BUSINESS', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to Dispute
ALTER TABLE "Dispute"
  ADD COLUMN IF NOT EXISTS "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "assigneeType" "TicketAssigneeType" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN IF NOT EXISTS "assignedToAgentId" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedToBusinessId" TEXT;

-- FK constraints
DO $$ BEGIN
  ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_assignedToAgentId_fkey"
    FOREIGN KEY ("assignedToAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_assignedToBusinessId_fkey"
    FOREIGN KEY ("assignedToBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "Dispute_assignedToAgentId_idx" ON "Dispute"("assignedToAgentId");
CREATE INDEX IF NOT EXISTS "Dispute_assignedToBusinessId_idx" ON "Dispute"("assignedToBusinessId");

-- TicketMessage table
CREATE TABLE IF NOT EXISTS "TicketMessage" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "disputeId"  TEXT NOT NULL,
  "authorId"   TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "internal"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_disputeId_fkey"
    FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "TicketMessage_disputeId_idx" ON "TicketMessage"("disputeId");
