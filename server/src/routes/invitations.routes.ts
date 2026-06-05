import { Router } from "express";

import {
  acceptInvitationController,
  getInvitationPreviewController,
} from "../controllers/workspace-invitations.controller.js";
import { optionalAuth } from "../middleware/optional-auth.middleware.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const invitationsRouter = Router();

// Token-based routes: resolve invitation by token only; ignore X-Workspace-Id.
invitationsRouter.get("/:token", optionalAuth, getInvitationPreviewController);
invitationsRouter.post("/:token/accept", requireAuth, acceptInvitationController);
