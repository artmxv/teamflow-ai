import { Router } from "express";

import {
  getWorkspaceMembersController,
  updateWorkspaceController,
} from "../controllers/workspace.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);
workspaceRouter.get("/members", getWorkspaceMembersController);
workspaceRouter.patch("/", updateWorkspaceController);
