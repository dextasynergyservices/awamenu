-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "cancelledMessageSentAt" TIMESTAMP(3),
ADD COLUMN     "refundedAt" TIMESTAMP(3);
