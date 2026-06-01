import { Router } from "express";

import { createProjectController, getProjectsController } from "../controllers/projects.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get("/", getProjectsController);
projectsRouter.post("/", createProjectController);
