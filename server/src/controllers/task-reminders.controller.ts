import type { NextFunction, Request, Response } from "express";

import { runTaskDeadlineReminders } from "../services/task-reminders.service.js";

export async function runTaskRemindersController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await runTaskDeadlineReminders();
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
