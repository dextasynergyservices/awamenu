-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "soldOutUntil" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
