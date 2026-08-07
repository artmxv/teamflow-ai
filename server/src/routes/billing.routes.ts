import { Router } from "express";

import {
  confirmPaymentController,
  createPlanChangeController,
  getBillingSummaryController,
} from "../controllers/billing.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const billingRouter = Router();

billingRouter.use(requireAuth);
billingRouter.get("/summary", getBillingSummaryController);
billingRouter.post("/change-plan", createPlanChangeController);
billingRouter.post("/confirm-payment", confirmPaymentController);
