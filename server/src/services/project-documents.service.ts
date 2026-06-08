import { prisma } from "../lib/prisma.js";
import {
  buildObjectKey,
  buildStoredObjectFilename,
  deleteStoredFile,
  persistUploadedFile,
  resolveStoredFile,
  shouldUseSupabaseForProjectTaskUploads,
} from "../lib/file-storage/index.js";
import { decodeMulterOriginalName } from "../lib/project-upload.js";
import { notifyProjectDocumentUploaded } from "./notifications.service.js";
import { resolveProjectAccess } from "./projects.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

const uploaderSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

export type ProjectDocumentAccessError = "not_found" | "forbidden";

function buildDownloadUrl(projectId: string, documentId: string) {
  return `/api/projects/${projectId}/documents/${documentId}/file`;
}

function mapDocument(document: {
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
    id: document.id,
    filename: document.filename,
    originalName: document.originalName,
    mimeType: document.mimeType,
    size: document.size,
    url: document.url,
    downloadUrl: document.url,
    createdAt: document.createdAt,
    uploader: document.uploader,
  };
}

const SUPABASE_UPLOAD_REQUIRED_MESSAGE =
  "Project document uploads require Supabase Storage. Set FILE_STORAGE_DRIVER=supabase with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.";

export async function getProjectDocuments(
  workspaceId: string,
  projectId: string,
  userId: string,
  role: WorkspaceRole,
) {
  const access = await resolveProjectAccess(projectId, workspaceId, userId, role);
  if (!access.ok) {
    return access.reason;
  }

  const documents = await prisma.projectDocument.findMany({
    where: { projectId },
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

  return documents.map(mapDocument);
}

export async function createProjectDocument(
  workspaceId: string,
  projectId: string,
  uploaderId: string,
  role: WorkspaceRole,
  file: Express.Multer.File,
) {
  if (!shouldUseSupabaseForProjectTaskUploads()) {
    throw new Error(SUPABASE_UPLOAD_REQUIRED_MESSAGE);
  }

  const originalName = decodeMulterOriginalName(file.originalname);
  const filename = buildObjectKey({
    category: "project",
    workspaceId,
    entityId: projectId,
    storedFilename: buildStoredObjectFilename(originalName),
  });
  const access = await resolveProjectAccess(projectId, workspaceId, uploaderId, role);
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

    const document = await prisma.projectDocument.create({
      data: {
        projectId,
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

    const downloadUrl = buildDownloadUrl(projectId, document.id);

    const updated = await prisma.projectDocument.update({
      where: { id: document.id },
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

    void notifyProjectDocumentUploaded({
      workspaceId,
      projectId,
      actorId: uploaderId,
      fileName: updated.originalName,
    });

    return mapDocument(updated);
  } catch (error) {
    await deleteStoredFile({ category: "project", entityId: projectId, filename });
    throw error;
  }
}

export async function deleteProjectDocument(
  workspaceId: string,
  projectId: string,
  documentId: string,
  userId: string,
  role: WorkspaceRole,
) {
  const access = await resolveProjectAccess(projectId, workspaceId, userId, role);
  if (!access.ok) {
    return access.reason;
  }

  const document = await prisma.projectDocument.findFirst({
    where: { id: documentId, projectId },
    select: { id: true, filename: true },
  });

  if (!document) {
    return "document_not_found" as const;
  }

  await deleteStoredFile({
    category: "project",
    entityId: projectId,
    filename: document.filename,
  });

  await prisma.projectDocument.delete({
    where: { id: documentId },
  });

  return { id: documentId };
}

export async function getProjectDocumentFile(
  workspaceId: string,
  projectId: string,
  documentId: string,
  userId: string,
  role: WorkspaceRole,
) {
  const access = await resolveProjectAccess(projectId, workspaceId, userId, role);
  if (!access.ok) {
    return access.reason;
  }

  const document = await prisma.projectDocument.findFirst({
    where: { id: documentId, projectId },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
    },
  });

  if (!document) {
    return "document_not_found" as const;
  }

  const resolved = await resolveStoredFile({
    category: "project",
    entityId: projectId,
    filename: document.filename,
    mimeType: document.mimeType,
    originalName: document.originalName,
  });

  if (!resolved) {
    return "missing_file" as const;
  }

  return resolved;
}
