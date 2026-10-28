-- CreateEnum
CREATE TYPE "OutboxJobKind" AS ENUM ('EMAIL', 'MESSAGE', 'WEB_PUSH');

-- CreateEnum
CREATE TYPE "OutboxJobStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "OutboxJob" (
    "id" TEXT NOT NULL,
    "kind" "OutboxJobKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboxJob_status_runAfter_idx" ON "OutboxJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "OutboxJob_sentAt_idx" ON "OutboxJob"("sentAt");
