-- CreateTable
CREATE TABLE "WorkspaceChatMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceChatMessage_workspaceId_createdAt_idx" ON "WorkspaceChatMessage"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceChatMessage_senderId_idx" ON "WorkspaceChatMessage"("senderId");

-- AddForeignKey
ALTER TABLE "WorkspaceChatMessage" ADD CONSTRAINT "WorkspaceChatMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChatMessage" ADD CONSTRAINT "WorkspaceChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
