import { Router } from "express";

import {
  getWorkspaceAiSummaryController,
  postAiCopilotChatController,
} from "../controllers/ai.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.post("/workspace-summary", getWorkspaceAiSummaryController);
aiRouter.post("/copilot/chat", postAiCopilotChatController);
