-- Add UNDER_REVIEW to TaskStatus enum
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';

-- Add SubmissionRound enum
DO $$ BEGIN
  CREATE TYPE "SubmissionRound" AS ENUM ('FIRST_DRAFT', 'SECOND_DRAFT', 'FINAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add SubmissionType enum
DO $$ BEGIN
  CREATE TYPE "SubmissionType" AS ENUM ('FILE', 'LINK', 'TEXT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add SubmissionStatus enum
DO $$ BEGIN
  CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create TaskSubmission table
CREATE TABLE IF NOT EXISTS "TaskSubmission" (
    "id"          TEXT NOT NULL,
    "taskId"      TEXT NOT NULL,
    "agentId"     TEXT NOT NULL,
    "round"       "SubmissionRound" NOT NULL,
    "type"        "SubmissionType" NOT NULL,
    "content"     TEXT,
    "fileUrl"     TEXT,
    "fileName"    TEXT,
    "fileSize"    INTEGER,
    "mimeType"    TEXT,
    "notes"       TEXT,
    "status"      "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewNote"  TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt"  TIMESTAMP(3),
    CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "TaskSubmission_taskId_idx" ON "TaskSubmission"("taskId");
CREATE INDEX IF NOT EXISTS "TaskSubmission_agentId_idx" ON "TaskSubmission"("agentId");
CREATE INDEX IF NOT EXISTS "TaskSubmission_taskId_round_idx" ON "TaskSubmission"("taskId", "round");

-- Foreign keys
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
