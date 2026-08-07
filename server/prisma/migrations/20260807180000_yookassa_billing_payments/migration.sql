-- CreateEnum
CREATE TYPE "BillingPaymentProvider" AS ENUM ('YOOKASSA');

-- CreateEnum
CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'CANCELED');

-- CreateTable
CREATE TABLE "BillingPayment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "BillingPaymentProvider" NOT NULL DEFAULT 'YOOKASSA',
    "providerPaymentId" TEXT,
    "targetPlan" "BillingPlan" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingPayment_providerPaymentId_key" ON "BillingPayment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "BillingPayment_workspaceId_idx" ON "BillingPayment"("workspaceId");

-- CreateIndex
CREATE INDEX "BillingPayment_status_idx" ON "BillingPayment"("status");

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
