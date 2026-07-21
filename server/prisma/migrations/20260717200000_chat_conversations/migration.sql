-- CreateEnum
CREATE TYPE "ChatConversationType" AS ENUM ('WORKSPACE', 'DIRECT');

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "ChatConversationType" NOT NULL,
    "title" TEXT,
    "identityKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversationMember" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatConversationMember_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversation_identityKey_key" ON "ChatConversation"("identityKey");

-- CreateIndex
CREATE INDEX "ChatConversation_workspaceId_idx" ON "ChatConversation"("workspaceId");

-- CreateIndex
CREATE INDEX "ChatConversation_workspaceId_type_idx" ON "ChatConversation"("workspaceId", "type");

-- CreateIndex
CREATE INDEX "ChatConversationMember_userId_idx" ON "ChatConversationMember"("userId");

-- CreateIndex
CREATE INDEX "ChatConversationMember_userId_isPinned_idx" ON "ChatConversationMember"("userId", "isPinned");

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversationMember" ADD CONSTRAINT "ChatConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversationMember" ADD CONSTRAINT "ChatConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add nullable conversationId so existing rows can be backfilled safely.
ALTER TABLE "WorkspaceChatMessage" ADD COLUMN "conversationId" TEXT;

-- Create one WORKSPACE general conversation per workspace.
INSERT INTO "ChatConversation" ("id", "workspaceId", "type", "title", "identityKey", "createdAt", "updatedAt")
SELECT
    'cgen_' || w."id",
    w."id",
    'WORKSPACE'::"ChatConversationType",
    NULL,
    'workspace:' || w."id" || ':general',
    w."createdAt",
    w."updatedAt"
FROM "Workspace" w;

-- Add every ACTIVE workspace member to that workspace general conversation.
INSERT INTO "ChatConversationMember" ("conversationId", "userId", "lastReadAt", "isPinned", "joinedAt")
SELECT
    'cgen_' || wm."workspaceId",
    wm."userId",
    NULL,
    false,
    wm."joinedAt"
FROM "WorkspaceMember" wm
WHERE wm."status" = 'ACTIVE';

-- Move existing messages into the matching general conversation.
UPDATE "WorkspaceChatMessage" AS m
SET "conversationId" = 'cgen_' || m."workspaceId";

-- Preserve history: mark general chats as already read through the latest migrated message.
UPDATE "ChatConversationMember" AS cm
SET "lastReadAt" = latest."lastAt"
FROM (
    SELECT
        m."conversationId" AS "conversationId",
        MAX(m."createdAt") AS "lastAt"
    FROM "WorkspaceChatMessage" AS m
    WHERE m."conversationId" IS NOT NULL
    GROUP BY m."conversationId"
) AS latest
WHERE cm."conversationId" = latest."conversationId";

-- Keep conversation activity timestamps aligned with latest message when present.
UPDATE "ChatConversation" AS c
SET "updatedAt" = latest."lastAt"
FROM (
    SELECT
        m."conversationId" AS "conversationId",
        MAX(m."createdAt") AS "lastAt"
    FROM "WorkspaceChatMessage" AS m
    WHERE m."conversationId" IS NOT NULL
    GROUP BY m."conversationId"
) AS latest
WHERE c."id" = latest."conversationId";

-- Fail fast if any message was not linked.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "WorkspaceChatMessage"
        WHERE "conversationId" IS NULL
    ) THEN
        RAISE EXCEPTION 'Chat migration failed: WorkspaceChatMessage rows without conversationId remain';
    END IF;
END $$;

-- Enforce conversation ownership on messages.
ALTER TABLE "WorkspaceChatMessage" ALTER COLUMN "conversationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "WorkspaceChatMessage_conversationId_createdAt_id_idx" ON "WorkspaceChatMessage"("conversationId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "WorkspaceChatMessage" ADD CONSTRAINT "WorkspaceChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop legacy workspace-scoped message links.
DROP INDEX IF EXISTS "WorkspaceChatMessage_workspaceId_createdAt_idx";
ALTER TABLE "WorkspaceChatMessage" DROP CONSTRAINT "WorkspaceChatMessage_workspaceId_fkey";
ALTER TABLE "WorkspaceChatMessage" DROP COLUMN "workspaceId";
