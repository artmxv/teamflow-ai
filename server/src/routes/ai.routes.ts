import { Router } from "express";

import { getWorkspaceAiSummaryController } from "../controllers/ai.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.post("/workspace-summary", getWorkspaceAiSummaryController);
