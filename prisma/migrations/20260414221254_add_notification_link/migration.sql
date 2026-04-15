-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "MarketplaceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'CLOSED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "AgentType" AS ENUM ('EMPLOYEE', 'FREELANCER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable (idempotent)
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "agentType" "AgentType" NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "portfolioUrl" TEXT;

-- AlterTable (idempotent)
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "link" TEXT;

-- AlterTable (idempotent)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "adminRejectNote" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "isMarketplace" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "locationText" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "marketplaceExpiresAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "marketplaceStatus" "MarketplaceStatus";
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "maxBids" INTEGER DEFAULT 20;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "Bid" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "proposedCents" INTEGER NOT NULL,
    "coverNote" TEXT,
    "estimatedDays" INTEGER,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Bid_taskId_status_idx" ON "Bid"("taskId", "status");
CREATE INDEX IF NOT EXISTS "Bid_agentId_status_idx" ON "Bid"("agentId", "status");
CREATE INDEX IF NOT EXISTS "Bid_createdAt_idx" ON "Bid"("createdAt");

-- Unique index (idempotent)
DO $$ BEGIN
  CREATE UNIQUE INDEX "Bid_taskId_agentId_key" ON "Bid"("taskId", "agentId");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "Bid" ADD CONSTRAINT "Bid_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Bid" ADD CONSTRAINT "Bid_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
