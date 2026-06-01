import { Router } from "express";

import { updateWorkspaceController } from "../controllers/workspace.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);
workspaceRouter.patch("/", updateWorkspaceController);
