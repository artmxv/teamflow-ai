-- Optional idempotency key for notifications that require atomic delivery deduplication.
-- Existing rows remain valid with NULL values; PostgreSQL permits multiple NULLs in a unique index.
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
