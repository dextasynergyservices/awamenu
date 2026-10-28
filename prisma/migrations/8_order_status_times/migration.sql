-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "preparingAt" TIMESTAMP(3),
ADD COLUMN     "readyAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt");

-- When an order first reaches each stage, stamped by the database on every
-- status change so no code path can forget (owner, staff, payment webhooks,
-- crons, booking pre-orders). The first time wins; nothing is overwritten.
-- Columns are UTC wall time (Prisma's TIMESTAMP(3)), hence timezone('UTC', …).
CREATE OR REPLACE FUNCTION order_status_times() RETURNS trigger AS $$
DECLARE
  at timestamp(3) := timezone('UTC', now());
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED')
     AND NEW."confirmedAt" IS NULL THEN
    NEW."confirmedAt" := at;
  END IF;

  -- A person accepted it (only orders that were waiting for approval).
  IF TG_OP = 'UPDATE' AND OLD.status = 'PENDING_APPROVAL'
     AND NEW.status IN ('CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED')
     AND NEW."acceptedAt" IS NULL THEN
    NEW."acceptedAt" := at;
  END IF;

  IF NEW.status = 'PREPARING' AND NEW."preparingAt" IS NULL THEN
    NEW."preparingAt" := at;
  END IF;
  IF NEW.status = 'READY' AND NEW."readyAt" IS NULL THEN
    NEW."readyAt" := at;
  END IF;
  IF NEW.status = 'DELIVERED' AND NEW."deliveredAt" IS NULL THEN
    NEW."deliveredAt" := at;
  END IF;
  IF NEW.status = 'COMPLETED' AND NEW."completedAt" IS NULL THEN
    NEW."completedAt" := at;
  END IF;
  IF NEW.status = 'CANCELLED' AND NEW."cancelledAt" IS NULL THEN
    NEW."cancelledAt" := at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_status_times ON "Order";
CREATE TRIGGER order_status_times
  BEFORE INSERT OR UPDATE OF status ON "Order"
  FOR EACH ROW EXECUTE FUNCTION order_status_times();
