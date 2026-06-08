import { prisma } from "../lib/prisma.js";
import {
  buildObjectKey,
  buildStoredObjectFilename,
  deleteStoredFile,
  persistUploadedFile,
  resolveStoredFile,
  shouldUseSupabaseForProjectTaskUploads,
} from "../lib/file-storage/index.js";
import { decodeMulterOriginalName } from "../lib/task-upload.js";
import { notifyTaskAttachmentUploaded } from "./notifications.service.js";
import { resolveTaskAccess } from "./tasks.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

const uploaderSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

export type TaskAttachmentAccessError = "not_found" | "forbidden";

function buildDownloadUrl(taskId: string, attachmentId: string) {
  return `/api/tasks/${taskId}/attachments/${attachmentId}/file`;
}

function mapAttachment(attachment: {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: Date;
  uploader: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
}) {
  return {
    id: attachment.id,
    filename: attachment.filename,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.url,
    downloadUrl: attachment.url,
    createdAt: attachment.createdAt,
    uploader: attachment.uploader,
  };
}

const SUPABASE_UPLOAD_REQUIRED_MESSAGE =
  "Task attachment uploads require Supabase Storage. Set FILE_STORAGE_DRIVER=supabase with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.";

export async function getTaskAttachments(
  workspaceId: string,
  taskId: string,
  userId: string,
  role: WorkspaceRole,
) {
  const access = await resolveTaskAccess(taskId, workspaceId, userId, role);
  if (!access.ok) {
    return access.reason;
  }

  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
      size: true,
      url: true,
      createdAt: true,
      uploader: { select: uploaderSelect },
    },
  });

  return attachments.map(mapAttachment);
}

export async function createTaskAttachment(
  workspaceId: string,
  taskId: string,
  uploaderId: string,
  role: WorkspaceRole,
  file: Express.Multer.File,
) {
  if (!shouldUseSupabaseForProjectTaskUploads()) {
    throw new Error(SUPABASE_UPLOAD_REQUIRED_MESSAGE);
  }

  const originalName = decodeMulterOriginalName(file.originalname);
  const filename = buildObjectKey({
    category: "task",
    workspaceId,
    entityId: taskId,
    storedFilename: buildStoredObjectFilename(originalName),
  });
  const access = await resolveTaskAccess(taskId, workspaceId, uploaderId, role);
  if (!access.ok) {
    return access.reason;
  }

  if (!file.buffer) {
    throw new Error("Uploaded file buffer is missing");
  }

  try {
    await persistUploadedFile({
      objectKey: filename,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        uploaderId,
        filename,
        originalName,
        mimeType: file.mimetype,
        size: file.size,
        url: "pending",
      },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        size: true,
        url: true,
        createdAt: true,
        uploader: { select: uploaderSelect },
      },
    });

    const downloadUrl = buildDownloadUrl(taskId, attachment.id);

    const updated = await prisma.taskAttachment.update({
      where: { id: attachment.id },
      data: { url: downloadUrl },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        size: true,
        url: true,
        createdAt: true,
        uploader: { select: uploaderSelect },
      },
    });

    void notifyTaskAttachmentUploaded({
      workspaceId,
      taskId,
      actorId: uploaderId,
      fileName: updated.originalName,
    });

    return mapAttachment(updated);
  } catch (error) {
    await deleteStoredFile({ category: "task", entityId: taskId, filename });
    throw error;
  }
}

export async function deleteTaskAttachment(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
  userId: string,
  role: WorkspaceRole,
) {
  const access = await resolveTaskAccess(taskId, workspaceId, userId, role);
  if (!access.ok) {
    return access.reason;
  }

  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId },
    select: { id: true, filename: true },
  });

  if (!attachment) {
    return "attachment_not_found" as const;
  }

  await deleteStoredFile({ category: "task", entityId: taskId, filename: attachment.filename });

  await prisma.taskAttachment.delete({
    where: { id: attachmentId },
  });

  return { id: attachmentId };
}

export async function getTaskAttachmentFile(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
  userId: string,
  role: WorkspaceRole,
) {
  const access = await resolveTaskAccess(taskId, workspaceId, userId, role);
  if (!access.ok) {
    return access.reason;
  }

  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
    },
  });

  if (!attachment) {
    return "attachment_not_found" as const;
  }

  const resolved = await resolveStoredFile({
    category: "task",
    entityId: taskId,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    originalName: attachment.originalName,
  });

  if (!resolved) {
    return "missing_file" as const;
  }

  return resolved;
}
