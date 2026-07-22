-- CreateEnum
CREATE TYPE "ChatMessageAttachmentType" AS ENUM ('FILE', 'TASK', 'PROJECT');

-- CreateTable
CREATE TABLE "ChatMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" "ChatMessageAttachmentType" NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageKey" TEXT,
    "taskId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessageAttachment_messageId_idx" ON "ChatMessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "ChatMessageAttachment_type_idx" ON "ChatMessageAttachment"("type");

-- CreateIndex
CREATE INDEX "ChatMessageAttachment_taskId_idx" ON "ChatMessageAttachment"("taskId");

-- CreateIndex
CREATE INDEX "ChatMessageAttachment_projectId_idx" ON "ChatMessageAttachment"("projectId");

-- AddForeignKey
ALTER TABLE "ChatMessageAttachment" ADD CONSTRAINT "ChatMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WorkspaceChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageAttachment" ADD CONSTRAINT "ChatMessageAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageAttachment" ADD CONSTRAINT "ChatMessageAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
