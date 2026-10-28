-- AlterTable
ALTER TABLE "SubscriptionPayment" ADD COLUMN     "method" TEXT,
ADD COLUMN     "recordedById" TEXT;

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "commissionPercent" DECIMAL(5,2),
ADD COLUMN     "platformChargeKobo" INTEGER;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "commissionNote" TEXT,
ADD COLUMN     "commissionPercentOverride" DECIMAL(5,2),
ADD COLUMN     "commissionUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Restaurant_createdAt_idx" ON "Restaurant"("createdAt");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderPayment_createdAt_idx" ON "OrderPayment"("createdAt");

-- CreateIndex
CREATE INDEX "Reservation_restaurantId_startsAt_idx" ON "Reservation"("restaurantId", "startsAt");

-- CreateIndex
CREATE INDEX "Rating_restaurantId_createdAt_idx" ON "Rating"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_createdAt_idx" ON "Rating"("createdAt");
