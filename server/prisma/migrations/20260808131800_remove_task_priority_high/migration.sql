-- Remap legacy HIGH tasks before removing the enum value.
-- Old "high" priority maps to URGENT so severity is not silently lowered.
UPDATE "Task"
SET "priority" = 'URGENT'
WHERE "priority" = 'HIGH';

ALTER TABLE "Task" ALTER COLUMN "priority" DROP DEFAULT;

CREATE TYPE "TaskPriority_next" AS ENUM ('LOW', 'MEDIUM', 'URGENT');

ALTER TABLE "Task"
ALTER COLUMN "priority" TYPE "TaskPriority_next"
USING ("priority"::text::"TaskPriority_next");

DROP TYPE "TaskPriority";
ALTER TYPE "TaskPriority_next" RENAME TO "TaskPriority";
ALTER TABLE "Task" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
