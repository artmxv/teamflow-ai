import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import {
  MAX_TASK_ATTACHMENT_BYTES,
  removeStoredTaskAttachment,
  taskAttachmentUpload,
} from "../lib/task-upload.js";
import {
  createTaskAttachment,
  deleteTaskAttachment,
  getTaskAttachmentFile,
  getTaskAttachments,
  type TaskAttachmentAccessError,
} from "../services/task-attachments.service.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";
import { resolveTaskAccessForUser } from "../services/tasks.service.js";

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

function respondTaskAccessError(res: Response, reason: TaskAttachmentAccessError) {
  if (reason === "forbidden") {
    res.status(403).json({ message: "You don't have access to this task" });
    return;
  }

  res.status(404).json({ message: "Task not found" });
}

export async function getTaskAttachmentsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const taskId = req.params.id;
    if (typeof taskId !== "string") {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const preferredContext = await resolveRequestWorkspaceContext(req.userId!, req);
    const access = await resolveTaskAccessForUser(taskId, req.userId!, preferredContext);
    if (!access.ok) {
      respondTaskAccessError(res, access.reason);
      return;
    }

    const attachments = await getTaskAttachments(
      access.workspaceId,
      taskId,
      req.userId!,
      access.role,
    );

    if (attachments === "not_found" || attachments === "forbidden") {
      respondTaskAccessError(res, attachments);
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

      const taskId = req.params.id;
      if (typeof taskId !== "string") {
        res.status(404).json({ message: "Task not found" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "File is required" });
        return;
      }

      const preferredContext = await resolveRequestWorkspaceContext(req.userId!, req);
      const access = await resolveTaskAccessForUser(taskId, req.userId!, preferredContext);
      if (!access.ok) {
        removeStoredTaskAttachment(taskId, req.file.filename);
        respondTaskAccessError(res, access.reason);
        return;
      }

      const attachment = await createTaskAttachment(
        access.workspaceId,
        taskId,
        req.userId!,
        access.role,
        req.file,
      );

      if (attachment === "not_found" || attachment === "forbidden") {
        respondTaskAccessError(res, attachment);
        return;
      }

      res.status(201).json({ data: attachment });
    } catch (uploadError) {
      const taskId = req.params.id;
      if (typeof taskId === "string" && req.file) {
        removeStoredTaskAttachment(taskId, req.file.filename);
      }
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
    const taskId = req.params.id;
    const attachmentId = req.params.attachmentId;

    if (typeof taskId !== "string" || typeof attachmentId !== "string") {
      res.status(404).json({ message: "Attachment not found" });
      return;
    }

    const preferredContext = await resolveRequestWorkspaceContext(req.userId!, req);
    const access = await resolveTaskAccessForUser(taskId, req.userId!, preferredContext);
    if (!access.ok) {
      respondTaskAccessError(res, access.reason);
      return;
    }

    const deleted = await deleteTaskAttachment(
      access.workspaceId,
      taskId,
      attachmentId,
      req.userId!,
      access.role,
    );

    if (deleted === "not_found" || deleted === "forbidden") {
      respondTaskAccessError(res, deleted);
      return;
    }

    if (deleted === "attachment_not_found") {
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
    const taskId = req.params.id;
    const attachmentId = req.params.attachmentId;

    if (typeof taskId !== "string" || typeof attachmentId !== "string") {
      res.status(404).json({ message: "Attachment not found" });
      return;
    }

    const preferredContext = await resolveRequestWorkspaceContext(req.userId!, req);
    const access = await resolveTaskAccessForUser(taskId, req.userId!, preferredContext);
    if (!access.ok) {
      respondTaskAccessError(res, access.reason);
      return;
    }

    const file = await getTaskAttachmentFile(
      access.workspaceId,
      taskId,
      attachmentId,
      req.userId!,
      access.role,
    );

    if (file === "not_found" || file === "forbidden") {
      respondTaskAccessError(res, file);
      return;
    }

    if (file === "attachment_not_found") {
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
