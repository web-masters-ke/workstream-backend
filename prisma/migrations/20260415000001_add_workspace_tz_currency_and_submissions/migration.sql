-- Add timezone and currency to Workspace
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'UTC';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'USD';

-- Add UNDER_REVIEW to TaskStatus enum (if not exists)
DO $$ BEGIN
  ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add SubmissionRound enum (if not exists)
DO $$ BEGIN
  CREATE TYPE "SubmissionRound" AS ENUM ('FIRST_DRAFT', 'SECOND_DRAFT', 'FINAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add SubmissionType enum (if not exists)
DO $$ BEGIN
  CREATE TYPE "SubmissionType" AS ENUM ('FILE', 'LINK', 'TEXT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add SubmissionStatus enum (if not exists)
DO $$ BEGIN
  CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create TaskSubmission table (if not exists)
CREATE TABLE IF NOT EXISTS "TaskSubmission" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "taskId"       TEXT NOT NULL,
  "agentId"      TEXT NOT NULL,
  "round"        "SubmissionRound" NOT NULL DEFAULT 'FIRST_DRAFT',
  "type"         "SubmissionType" NOT NULL DEFAULT 'TEXT',
  "content"      TEXT NOT NULL,
  "notes"        TEXT,
  "status"       "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reviewNote"   TEXT,
  "reviewedById" TEXT,
  "reviewedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY ("id")
);

-- FK constraints (if not exists)
DO $$ BEGIN
  ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "TaskSubmission_taskId_idx" ON "TaskSubmission"("taskId");
CREATE INDEX IF NOT EXISTS "TaskSubmission_agentId_idx" ON "TaskSubmission"("agentId");
