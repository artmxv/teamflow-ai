import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { createTask, getTasks, updateTask } from "../services/tasks.service.js";

const createTaskSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  title: z.string().trim().min(2, "title must be at least 2 characters"),
  description: z.string().max(500, "description must be at most 500 characters").optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(2, "title must be at least 2 characters").optional(),
  description: z.string().max(500, "description must be at most 500 characters").nullable().optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function getTasksController(_req: Request, res: Response, next: NextFunction) {
  try {
    const tasks = await getTasks();
    res.json({ data: tasks });
  } catch (error) {
    next(error);
  }
}

export async function createTaskController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = createTaskSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Invalid task payload",
        issues: result.error.issues,
      });
      return;
    }

    const task = await createTask(result.data);
    res.status(201).json({ data: task });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskController(req: Request, res: Response, next: NextFunction) {
  try {
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

    const task = await updateTask(taskId, result.data);

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
