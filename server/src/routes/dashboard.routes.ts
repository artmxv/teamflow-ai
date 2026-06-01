import { Router } from "express";

import { getDashboardSummaryController } from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/summary", getDashboardSummaryController);
