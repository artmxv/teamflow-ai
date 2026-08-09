-- Add the authoritative entitlement owner before allowing the source workspace to be deleted.
ALTER TABLE "BillingPayment" ADD COLUMN "ownerUserId" TEXT;

-- Existing TeamFlow workspaces have exactly one active OWNER. Refuse an ambiguous backfill
-- instead of silently assigning a payment to an arbitrary user.
DO $$
BEGIN
  IF EXISTS (
    SELECT payment."id"
    FROM "BillingPayment" AS payment
    LEFT JOIN "WorkspaceMember" AS member
      ON member."workspaceId" = payment."workspaceId"
      AND member."role" = 'OWNER'
      AND member."status" = 'ACTIVE'
    GROUP BY payment."id"
    HAVING COUNT(member."userId") <> 1
  ) THEN
    RAISE EXCEPTION 'Cannot backfill BillingPayment.ownerUserId: every payment must have exactly one active workspace owner';
  END IF;
END $$;

UPDATE "BillingPayment" AS payment
SET "ownerUserId" = member."userId"
FROM "WorkspaceMember" AS member
WHERE member."workspaceId" = payment."workspaceId"
  AND member."role" = 'OWNER'
  AND member."status" = 'ACTIVE';

ALTER TABLE "BillingPayment" ALTER COLUMN "ownerUserId" SET NOT NULL;
ALTER TABLE "BillingPayment" ALTER COLUMN "workspaceId" DROP NOT NULL;

DROP INDEX "BillingPayment_workspaceId_idx";
DROP INDEX "BillingPayment_status_idx";

ALTER TABLE "BillingPayment" DROP CONSTRAINT "BillingPayment_workspaceId_fkey";
ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "BillingPayment_workspaceId_idx" ON "BillingPayment"("workspaceId");
CREATE INDEX "BillingPayment_status_idx" ON "BillingPayment"("status");
CREATE INDEX "BillingPayment_ownerUserId_status_idx" ON "BillingPayment"("ownerUserId", "status");
