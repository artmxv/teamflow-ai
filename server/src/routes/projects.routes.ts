import { Router } from "express";

import {
  deleteProjectDocumentController,
  downloadProjectDocumentController,
  getProjectDocumentsController,
  uploadProjectDocumentController,
} from "../controllers/project-documents.controller.js";
import {
  createProjectController,
  deleteProjectController,
  getProjectsController,
  updateProjectController,
} from "../controllers/projects.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get("/", getProjectsController);
projectsRouter.post("/", createProjectController);
projectsRouter.get("/:id/documents", getProjectDocumentsController);
projectsRouter.post("/:id/documents", uploadProjectDocumentController);
projectsRouter.get("/:id/documents/:documentId/file", downloadProjectDocumentController);
projectsRouter.delete("/:id/documents/:documentId", deleteProjectDocumentController);
projectsRouter.patch("/:id", updateProjectController);
projectsRouter.delete("/:id", deleteProjectController);
