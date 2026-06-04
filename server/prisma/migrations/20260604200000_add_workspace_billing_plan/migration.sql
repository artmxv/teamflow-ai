-- CreateEnum
CREATE TYPE "BillingPlan" AS ENUM ('FREE', 'TEAM', 'BUSINESS', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "plan" "BillingPlan" NOT NULL DEFAULT 'FREE';
