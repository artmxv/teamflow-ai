import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { validateTaskReminderCronSecret } from "../lib/cron-secret.js";

export function requireTaskReminderCronSecret(req: Request, res: Response, next: NextFunction) {
  const validation = validateTaskReminderCronSecret(
    env.TASK_REMINDER_CRON_SECRET,
    req.headers.authorization,
  );

  if (validation === "missing_config") {
    res.status(503).json({ message: "Task reminders are not configured" });
    return;
  }

  if (validation === "invalid") {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  next();
}
