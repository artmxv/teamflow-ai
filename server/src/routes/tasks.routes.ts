import { Router } from "express";

import {
  createTaskController,
  getTasksController,
  updateTaskController,
} from "../controllers/tasks.controller.js";

export const tasksRouter = Router();

tasksRouter.get("/", getTasksController);
tasksRouter.post("/", createTaskController);
tasksRouter.patch("/:id", updateTaskController);
