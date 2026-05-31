import { Router } from "express";

import { getTasksController } from "../controllers/tasks.controller.js";

export const tasksRouter = Router();

tasksRouter.get("/", getTasksController);
