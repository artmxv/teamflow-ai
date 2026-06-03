import fs from "node:fs";

import { prisma } from "../lib/prisma.js";
import {
  decodeMulterOriginalName,
  projectDocumentDiskPath,
  removeStoredProjectDocument,
} from "../lib/project-upload.js";
import { findProjectInWorkspace } from "./projects.service.js";

const uploaderSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

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

export async function getProjectDocuments(workspaceId: string, projectId: string) {
  const project = await findProjectInWorkspace(projectId, workspaceId);
  if (!project) {
    return null;
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
  file: Express.Multer.File,
) {
  const project = await findProjectInWorkspace(projectId, workspaceId);
  if (!project) {
    removeStoredProjectDocument(projectId, file.filename);
    return null;
  }

  const document = await prisma.projectDocument.create({
    data: {
      projectId,
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

  return mapDocument(updated);
}

export async function deleteProjectDocument(
  workspaceId: string,
  projectId: string,
  documentId: string,
) {
  const project = await findProjectInWorkspace(projectId, workspaceId);
  if (!project) {
    return null;
  }

  const document = await prisma.projectDocument.findFirst({
    where: { id: documentId, projectId },
    select: { id: true, filename: true },
  });

  if (!document) {
    return "not_found" as const;
  }

  removeStoredProjectDocument(projectId, document.filename);

  await prisma.projectDocument.delete({
    where: { id: documentId },
  });

  return { id: documentId };
}

export async function getProjectDocumentFile(
  workspaceId: string,
  projectId: string,
  documentId: string,
) {
  const project = await findProjectInWorkspace(projectId, workspaceId);
  if (!project) {
    return null;
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
    return "not_found" as const;
  }

  const filePath = projectDocumentDiskPath(projectId, document.filename);

  if (!fs.existsSync(filePath)) {
    return "missing_file" as const;
  }

  return {
    filePath,
    mimeType: document.mimeType,
    originalName: document.originalName,
  };
}
