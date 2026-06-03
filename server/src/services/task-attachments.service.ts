import fs from "node:fs";

import { prisma } from "../lib/prisma.js";
import {
  decodeMulterOriginalName,
  removeStoredTaskAttachment,
  taskAttachmentDiskPath,
} from "../lib/task-upload.js";
import { notifyTaskAttachmentUploaded } from "./notifications.service.js";
import { findTaskInWorkspace } from "./tasks.service.js";

const uploaderSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

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

export async function getTaskAttachments(workspaceId: string, taskId: string) {
  const task = await findTaskInWorkspace(taskId, workspaceId);
  if (!task) {
    return null;
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
  file: Express.Multer.File,
) {
  const task = await findTaskInWorkspace(taskId, workspaceId);
  if (!task) {
    removeStoredTaskAttachment(taskId, file.filename);
    return null;
  }

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId,
      uploaderId,
      filename: file.filename,
      originalName: decodeMulterOriginalName(file.originalname),
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
}

export async function deleteTaskAttachment(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
) {
  const task = await findTaskInWorkspace(taskId, workspaceId);
  if (!task) {
    return null;
  }

  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId },
    select: { id: true, filename: true },
  });

  if (!attachment) {
    return "not_found" as const;
  }

  removeStoredTaskAttachment(taskId, attachment.filename);

  await prisma.taskAttachment.delete({
    where: { id: attachmentId },
  });

  return { id: attachmentId };
}

export async function getTaskAttachmentFile(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
) {
  const task = await findTaskInWorkspace(taskId, workspaceId);
  if (!task) {
    return null;
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
    return "not_found" as const;
  }

  const filePath = taskAttachmentDiskPath(taskId, attachment.filename);

  if (!fs.existsSync(filePath)) {
    return "missing_file" as const;
  }

  return {
    filePath,
    mimeType: attachment.mimeType,
    originalName: attachment.originalName,
  };
}
