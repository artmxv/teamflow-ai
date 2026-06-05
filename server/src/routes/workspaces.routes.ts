import { Router } from "express";

import {
  createWorkspaceController,
  deleteWorkspaceController,
  listWorkspacesController,
  switchWorkspaceController,
} from "../controllers/workspaces.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);
workspacesRouter.get("/", listWorkspacesController);
workspacesRouter.post("/", createWorkspaceController);
workspacesRouter.patch("/current", switchWorkspaceController);
workspacesRouter.delete("/:workspaceId", deleteWorkspaceController);
