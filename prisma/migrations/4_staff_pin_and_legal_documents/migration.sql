-- CreateEnum
CREATE TYPE "LegalDocumentKind" AS ENUM ('PRIVACY', 'TERMS', 'REFUNDS');

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "pinLockedUntil" TIMESTAMP(3),
ADD COLUMN     "pinSetAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "legalAddress" TEXT,
ADD COLUMN     "legalCompanyName" TEXT,
ADD COLUMN     "legalContactEmail" TEXT,
ADD COLUMN     "legalPrivacyEmail" TEXT,
ADD COLUMN     "legalRcNumber" TEXT;

-- CreateTable
CREATE TABLE "LegalDocument" (
    "kind" "LegalDocumentKind" NOT NULL,
    "intro" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("kind")
);
