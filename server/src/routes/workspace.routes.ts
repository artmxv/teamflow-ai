import { Router } from "express";

import {
  createWorkspaceInvitationController,
  listWorkspaceInvitationsController,
  revokeWorkspaceInvitationController,
} from "../controllers/workspace-invitations.controller.js";
import {
  getWorkspaceMembersController,
  removeWorkspaceMemberController,
  updateWorkspaceController,
  updateWorkspaceMemberRoleController,
} from "../controllers/workspace.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);
workspaceRouter.get("/members", getWorkspaceMembersController);
workspaceRouter.patch("/members/:memberId", updateWorkspaceMemberRoleController);
workspaceRouter.delete("/members/:memberId", removeWorkspaceMemberController);
workspaceRouter.get("/invitations", listWorkspaceInvitationsController);
workspaceRouter.post("/invitations", createWorkspaceInvitationController);
workspaceRouter.delete("/invitations/:id", revokeWorkspaceInvitationController);
workspaceRouter.patch("/", updateWorkspaceController);
