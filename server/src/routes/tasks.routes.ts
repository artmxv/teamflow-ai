import { Router } from "express";

import {
  createTaskController,
  deleteTaskController,
  getTasksController,
  updateTaskController,
} from "../controllers/tasks.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get("/", getTasksController);
tasksRouter.post("/", createTaskController);
tasksRouter.patch("/:id", updateTaskController);
tasksRouter.delete("/:id", deleteTaskController);
