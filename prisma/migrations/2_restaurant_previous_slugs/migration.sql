-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];

