import { Router } from "express";

import {
  createTaskController,
  deleteTaskController,
  getTasksController,
  updateTaskController,
} from "../controllers/tasks.controller.js";

export const tasksRouter = Router();

tasksRouter.get("/", getTasksController);
tasksRouter.post("/", createTaskController);
tasksRouter.patch("/:id", updateTaskController);
tasksRouter.delete("/:id", deleteTaskController);
