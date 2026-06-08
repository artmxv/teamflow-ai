import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import { sendResolvedStoredFile } from "../lib/file-storage/index.js";
import {
  MAX_PROJECT_DOCUMENT_BYTES,
  projectDocumentUpload,
} from "../lib/project-upload.js";
import {
  createProjectDocument,
  deleteProjectDocument,
  getProjectDocumentFile,
  getProjectDocuments,
  type ProjectDocumentAccessError,
} from "../services/project-documents.service.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";
import { resolveProjectAccessForUser } from "../services/projects.service.js";

function handleUploadError(error: unknown, res: Response) {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "File must be 10 MB or smaller" });
      return true;
    }
  }

  if (error instanceof Error && error.message === "Unsupported file type") {
    res.status(400).json({ message: error.message });
    return true;
  }

  return false;
}

function handleStorageUploadError(error: unknown, res: Response) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (
    error.message.includes("Supabase Storage") ||
    error.message.includes("require Supabase Storage")
  ) {
    res.status(500).json({ message: error.message });
    return true;
  }

  return false;
}

function respondProjectAccessError(res: Response, reason: ProjectDocumentAccessError) {
  if (reason === "forbidden") {
    res.status(403).json({ message: "You don't have access to this project" });
    return;
  }

  res.status(404).json({ message: "Project not found" });
}

export async function getProjectDocumentsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const projectId = req.params.id;
    if (typeof projectId !== "string") {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const preferredContext = await resolveRequestWorkspaceContext(req.userId!, req);
    const access = await resolveProjectAccessForUser(projectId, req.userId!, preferredContext);
    if (!access.ok) {
      respondProjectAccessError(res, access.reason);
      return;
    }

    const documents = await getProjectDocuments(
      access.workspaceId,
      projectId,
      req.userId!,
      access.role,
    );

    if (documents === "not_found" || documents === "forbidden") {
      respondProjectAccessError(res, documents);
      return;
    }

    res.json({ data: documents });
  } catch (error) {
    next(error);
  }
}

export async function uploadProjectDocumentController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  projectDocumentUpload.single("file")(req, res, async (error) => {
    try {
      if (error) {
        if (handleUploadError(error, res)) {
          return;
        }
        next(error);
        return;
      }

      const projectId = req.params.id;
      if (typeof projectId !== "string") {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "File is required" });
        return;
      }

      const preferredContext = await resolveRequestWorkspaceContext(req.userId!, req);
      const access = await resolveProjectAccessForUser(projectId, req.userId!, preferredContext);
      if (!access.ok) {
        respondProjectAccessError(res, access.reason);
        return;
      }

      const document = await createProjectDocument(
        access.workspaceId,
        projectId,
        req.userId!,
        access.role,
        req.file,
      );

      if (document === "not_found" || document === "forbidden") {
        respondProjectAccessError(res, document);
        return;
      }

      res.status(201).json({ data: document });
    } catch (uploadError) {
      if (handleStorageUploadError(uploadError, res)) {
        return;
      }
      next(uploadError);
    }
  });
}

export async function deleteProjectDocumentController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const projectId = req.params.id;
    const documentId = req.params.documentId;

    if (typeof projectId !== "string" || typeof documentId !== "string") {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const preferredContext = await resolveRequestWorkspaceContext(req.userId!, req);
    const access = await resolveProjectAccessForUser(projectId, req.userId!, preferredContext);
    if (!access.ok) {
      respondProjectAccessError(res, access.reason);
      return;
    }

    const deleted = await deleteProjectDocument(
      access.workspaceId,
      projectId,
      documentId,
      req.userId!,
      access.role,
    );

    if (deleted === "not_found" || deleted === "forbidden") {
      respondProjectAccessError(res, deleted);
      return;
    }

    if (deleted === "document_not_found") {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
}

export async function downloadProjectDocumentController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const projectId = req.params.id;
    const documentId = req.params.documentId;

    if (typeof projectId !== "string" || typeof documentId !== "string") {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const preferredContext = await resolveRequestWorkspaceContext(req.userId!, req);
    const access = await resolveProjectAccessForUser(projectId, req.userId!, preferredContext);
    if (!access.ok) {
      respondProjectAccessError(res, access.reason);
      return;
    }

    const file = await getProjectDocumentFile(
      access.workspaceId,
      projectId,
      documentId,
      req.userId!,
      access.role,
    );

    if (file === "not_found" || file === "forbidden") {
      respondProjectAccessError(res, file);
      return;
    }

    if (file === "document_not_found") {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    if (file === "missing_file") {
      res.status(404).json({ message: "File is no longer available on the server" });
      return;
    }

    await sendResolvedStoredFile(res, file, next);
  } catch (error) {
    next(error);
  }
}

export { MAX_PROJECT_DOCUMENT_BYTES };
