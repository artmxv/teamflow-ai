import { Router } from "express";

import {
  createWorkspaceInvitationController,
  listWorkspaceInvitationsController,
  revokeWorkspaceInvitationController,
} from "../controllers/workspace-invitations.controller.js";
import {
  getWorkspaceMembersController,
  updateWorkspaceController,
} from "../controllers/workspace.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);
workspaceRouter.get("/members", getWorkspaceMembersController);
workspaceRouter.get("/invitations", listWorkspaceInvitationsController);
workspaceRouter.post("/invitations", createWorkspaceInvitationController);
workspaceRouter.delete("/invitations/:id", revokeWorkspaceInvitationController);
workspaceRouter.patch("/", updateWorkspaceController);
