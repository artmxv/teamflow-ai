-- CreateTable
CREATE TABLE "WorkspaceChatMessagePin" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "pinnedById" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceChatMessagePin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceChatMessagePin_messageId_key" ON "WorkspaceChatMessagePin"("messageId");

-- CreateIndex
CREATE INDEX "WorkspaceChatMessagePin_messageId_idx" ON "WorkspaceChatMessagePin"("messageId");

-- CreateIndex
CREATE INDEX "WorkspaceChatMessagePin_pinnedById_idx" ON "WorkspaceChatMessagePin"("pinnedById");

-- CreateIndex
CREATE INDEX "WorkspaceChatMessagePin_pinnedAt_idx" ON "WorkspaceChatMessagePin"("pinnedAt");

-- AddForeignKey
ALTER TABLE "WorkspaceChatMessagePin" ADD CONSTRAINT "WorkspaceChatMessagePin_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WorkspaceChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChatMessagePin" ADD CONSTRAINT "WorkspaceChatMessagePin_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
