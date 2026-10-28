-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "freeDeliveryMinimum" DECIMAL(10,2);

