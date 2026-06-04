import { Router } from "express";

import {
  getBillingSummaryController,
  updateBillingPlanController,
} from "../controllers/billing.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const billingRouter = Router();

billingRouter.use(requireAuth);
billingRouter.get("/summary", getBillingSummaryController);
billingRouter.patch("/plan", updateBillingPlanController);
