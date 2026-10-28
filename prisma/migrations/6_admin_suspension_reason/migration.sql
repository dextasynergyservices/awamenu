-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspensionReason" TEXT;

-- Billing no longer switches restaurants off (see lib/billing-state.ts).
-- Turn back on any restaurant the old billing cron switched off for
-- non-payment; its subscription's dates now decide what it can do. A Super
-- Admin suspension (no SUSPENDED billing marker) is left alone.
UPDATE "Restaurant" AS r
SET "isActive" = true
FROM "Subscription" AS s
WHERE s."restaurantId" = r."id"
  AND s."lastExpiryNoticeStage" = 'SUSPENDED'
  AND r."isActive" = false;

-- Record when existing Super Admin suspensions began, as best we know.
UPDATE "Restaurant" SET "suspendedAt" = "updatedAt" WHERE "isActive" = false AND "suspendedAt" IS NULL;
