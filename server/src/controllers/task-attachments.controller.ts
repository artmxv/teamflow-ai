import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import { MAX_TASK_ATTACHMENT_BYTES, taskAttachmentUpload } from "../lib/task-upload.js";
import {
  createTaskAttachment,
  deleteTaskAttachment,
  getTaskAttachmentFile,
  getTaskAttachments,
} from "../services/task-attachments.service.js";
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

export async function getTaskAttachmentsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const taskId = req.params.id;
    if (typeof taskId !== "string") {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const attachments = await getTaskAttachments(context.workspaceId, taskId);

    if (attachments === null) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.json({ data: attachments });
  } catch (error) {
    next(error);
  }
}

export async function uploadTaskAttachmentController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  taskAttachmentUpload.single("file")(req, res, async (error) => {
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

      const taskId = req.params.id;
      if (typeof taskId !== "string") {
        res.status(404).json({ message: "Task not found" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "File is required" });
        return;
      }

      const attachment = await createTaskAttachment(
        context.workspaceId,
        taskId,
        req.userId!,
        req.file,
      );

      if (!attachment) {
        res.status(404).json({ message: "Task not found" });
        return;
      }

      res.status(201).json({ data: attachment });
    } catch (uploadError) {
      next(uploadError);
    }
  });
}

export async function deleteTaskAttachmentController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const taskId = req.params.id;
    const attachmentId = req.params.attachmentId;

    if (typeof taskId !== "string" || typeof attachmentId !== "string") {
      res.status(404).json({ message: "Attachment not found" });
      return;
    }

    const deleted = await deleteTaskAttachment(context.workspaceId, taskId, attachmentId);

    if (deleted === null) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    if (deleted === "not_found") {
      res.status(404).json({ message: "Attachment not found" });
      return;
    }

    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
}

export async function downloadTaskAttachmentController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const taskId = req.params.id;
    const attachmentId = req.params.attachmentId;

    if (typeof taskId !== "string" || typeof attachmentId !== "string") {
      res.status(404).json({ message: "Attachment not found" });
      return;
    }

    const file = await getTaskAttachmentFile(context.workspaceId, taskId, attachmentId);

    if (file === null) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    if (file === "not_found") {
      res.status(404).json({ message: "Attachment not found" });
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

export { MAX_TASK_ATTACHMENT_BYTES };
