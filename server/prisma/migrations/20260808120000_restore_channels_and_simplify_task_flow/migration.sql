-- Remap legacy TODO tasks before removing the enum value.
UPDATE "Task"
SET "status" = 'BACKLOG'
WHERE "status" = 'TODO';

ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "TaskStatus_next" AS ENUM ('BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE');

ALTER TABLE "Task"
ALTER COLUMN "status" TYPE "TaskStatus_next"
USING ("status"::text::"TaskStatus_next");

DROP TYPE "TaskStatus";
ALTER TYPE "TaskStatus_next" RENAME TO "TaskStatus";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'BACKLOG';

ALTER TYPE "ChatConversationType" ADD VALUE IF NOT EXISTS 'CHANNEL';
