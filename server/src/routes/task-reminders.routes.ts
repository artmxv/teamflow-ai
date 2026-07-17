import { Router } from "express";

import { runTaskRemindersController } from "../controllers/task-reminders.controller.js";
import { requireTaskReminderCronSecret } from "../middleware/require-cron-secret.middleware.js";

export const taskRemindersRouter = Router();

taskRemindersRouter.post("/run", requireTaskReminderCronSecret, runTaskRemindersController);
