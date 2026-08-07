import { Router, raw } from "express";

import { yookassaWebhookController } from "../controllers/billing.controller.js";

export const billingWebhookRouter = Router();

billingWebhookRouter.post("/", raw({ type: "application/json" }), yookassaWebhookController);
