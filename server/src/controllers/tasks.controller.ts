import type { NextFunction, Request, Response } from "express";

import { getTasks } from "../services/tasks.service.js";

export async function getTasksController(_req: Request, res: Response, next: NextFunction) {
  try {
    const tasks = await getTasks();
    res.json({ data: tasks });
  } catch (error) {
    next(error);
  }
}
