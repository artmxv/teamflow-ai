import { Router } from "express";

import { createProjectController, getProjectsController } from "../controllers/projects.controller.js";

export const projectsRouter = Router();

projectsRouter.get("/", getProjectsController);
projectsRouter.post("/", createProjectController);
