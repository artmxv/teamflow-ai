import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  createTaskComment,
  deleteTaskComment,
  getTaskComments,
  updateTaskComment,
} from "../services/task-comments.service.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";

const commentBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "body is required")
    .max(1000, "body must be at most 1000 characters"),
});

async function resolveWorkspace(req: Request, res: Response) {
  const context = await resolveRequestWorkspaceContext(req.userId!, req);
  if (!context) {
    res.status(403).json({ message: "Workspace not found" });
    return null;
  }
  return context;
}

export async function getTaskCommentsController(req: Request, res: Response, next: NextFunction) {
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

    const comments = await getTaskComments(context.workspaceId, taskId);

    if (comments === null) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.json({ data: comments });
  } catch (error) {
    next(error);
  }
}

export async function createTaskCommentController(req: Request, res: Response, next: NextFunction) {
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

    const result = commentBodySchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Invalid comment payload",
        issues: result.error.issues,
      });
      return;
    }

    const comment = await createTaskComment(
      context.workspaceId,
      taskId,
      req.userId!,
      result.data.body,
    );

    if (!comment) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.status(201).json({ data: comment });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskCommentController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const taskId = req.params.id;
    const commentId = req.params.commentId;

    if (typeof taskId !== "string" || typeof commentId !== "string") {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    const result = commentBodySchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Invalid comment payload",
        issues: result.error.issues,
      });
      return;
    }

    const updated = await updateTaskComment(
      context.workspaceId,
      taskId,
      commentId,
      req.userId!,
      result.data.body,
    );

    if (updated === null) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    if (updated === "not_found") {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    if (updated === "forbidden") {
      res.status(403).json({ message: "You can only edit your own comments" });
      return;
    }

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteTaskCommentController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const taskId = req.params.id;
    const commentId = req.params.commentId;

    if (typeof taskId !== "string" || typeof commentId !== "string") {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    const deleted = await deleteTaskComment(context.workspaceId, taskId, commentId, req.userId!);

    if (deleted === null) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    if (deleted === "not_found") {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    if (deleted === "forbidden") {
      res.status(403).json({ message: "You can only delete your own comments" });
      return;
    }

    res.json({ data: deleted });
  } catch (error) {
    next(error);
  }
}
