import { Router } from "express";

import { getProjectsController } from "../controllers/projects.controller.js";

export const projectsRouter = Router();

projectsRouter.get("/", getProjectsController);
