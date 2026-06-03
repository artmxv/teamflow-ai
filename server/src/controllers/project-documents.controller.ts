import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import { MAX_PROJECT_DOCUMENT_BYTES, projectDocumentUpload } from "../lib/project-upload.js";
import {
  createProjectDocument,
  deleteProjectDocument,
  getProjectDocumentFile,
  getProjectDocuments,
} from "../services/project-documents.service.js";
import { getUserWorkspaceContext } from "../services/workspace-context.service.js";

async function resolveWorkspace(req: Request, res: Response) {
  const context = await getUserWorkspaceContext(req.userId!);
  if (!context) {
    res.status(403).json({ message: "Workspace not found" });
    return null;
  }
  return context;
}

function handleUploadError(error: unknown, res: Response) {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "File must be 20 MB or smaller" });
      return true;
    }
  }

  if (error instanceof Error && error.message === "Unsupported file type") {
    res.status(400).json({ message: error.message });
    return true;
  }

  return false;
}

export async function getProjectDocumentsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const projectId = req.params.id;
    if (typeof projectId !== "string") {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const documents = await getProjectDocuments(context.workspaceId, projectId);

    if (documents === null) {
      res.status(404).json({ message: "Project not found" });
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

      const context = await resolveWorkspace(req, res);
      if (!context) {
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

      const document = await createProjectDocument(
        context.workspaceId,
        projectId,
        req.userId!,
        req.file,
      );

      if (!document) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      res.status(201).json({ data: document });
    } catch (uploadError) {
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
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const projectId = req.params.id;
    const documentId = req.params.documentId;

    if (typeof projectId !== "string" || typeof documentId !== "string") {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const deleted = await deleteProjectDocument(context.workspaceId, projectId, documentId);

    if (deleted === null) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (deleted === "not_found") {
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
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const projectId = req.params.id;
    const documentId = req.params.documentId;

    if (typeof projectId !== "string" || typeof documentId !== "string") {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const file = await getProjectDocumentFile(context.workspaceId, projectId, documentId);

    if (file === null) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (file === "not_found") {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    if (file === "missing_file") {
      res.status(404).json({ message: "File is no longer available on the server" });
      return;
    }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );
    res.sendFile(file.filePath, { maxAge: 0 }, (sendError) => {
      if (sendError && !res.headersSent) {
        next(sendError);
      }
    });
  } catch (error) {
    next(error);
  }
}

export { MAX_PROJECT_DOCUMENT_BYTES };
