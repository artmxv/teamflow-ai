import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { createTask, deleteTask, getTasks, updateTask } from "../services/tasks.service.js";
import { getUserWorkspaceContext } from "../services/workspace-context.service.js";

const createTaskSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  title: z.string().trim().min(2, "title must be at least 2 characters"),
  description: z.string().max(500, "description must be at most 500 characters").optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeIds: z.array(z.string()).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(2, "title must be at least 2 characters").optional(),
  description: z
    .string()
    .max(500, "description must be at most 500 characters")
    .nullable()
    .optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeIds: z.array(z.string()).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

async function resolveWorkspace(req: Request, res: Response) {
  const context = await getUserWorkspaceContext(req.userId!);
  if (!context) {
    res.status(403).json({ message: "Workspace not found" });
    return null;
  }
  return context;
}

export async function getTasksController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const tasks = await getTasks(context.workspaceId, req.userId!, context.role);
    res.json({ data: tasks });
  } catch (error) {
    next(error);
  }
}

export async function createTaskController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const result = createTaskSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Invalid task payload",
        issues: result.error.issues,
      });
      return;
    }

    const task = await createTask(context.workspaceId, req.userId!, context.role, result.data);

    if (!task) {
      res.status(404).json({
        message: "Project not found",
      });
      return;
    }

    res.status(201).json({ data: task });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const result = updateTaskSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Invalid task payload",
        issues: result.error.issues,
      });
      return;
    }

    const taskId = req.params.id;
    if (typeof taskId !== "string") {
      res.status(404).json({
        message: "Task not found",
      });
      return;
    }

    const task = await updateTask(
      context.workspaceId,
      taskId,
      result.data,
      req.userId!,
      context.role,
      req.userId!,
    );

    if (!task) {
      res.status(404).json({
        message: "Task not found",
      });
      return;
    }

    res.json({ data: task });
  } catch (error) {
    next(error);
  }
}

export async function deleteTaskController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const taskId = req.params.id;
    if (typeof taskId !== "string") {
      res.status(404).json({
        message: "Task not found",
      });
      return;
    }

    const deleted = await deleteTask(context.workspaceId, taskId, req.userId!, context.role);

    if (!deleted) {
      res.status(404).json({
        message: "Task not found",
      });
      return;
    }

    res.json({ data: { id: deleted.id } });
  } catch (error) {
    next(error);
  }
}
