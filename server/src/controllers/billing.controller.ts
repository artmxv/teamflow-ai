import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AuthError } from "../services/auth.service.js";
import { BillingPlanUsageError } from "../services/billing-plans.service.js";
import { getBillingSummary } from "../services/billing.service.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";
import {
  confirmBillingPayment,
  createBillingPlanChangeSession,
  handleYooKassaNotification,
  type YooKassaNotification,
} from "../services/yookassa-billing.service.js";

export const planChangeSchema = z.object({
  plan: z.enum(["FREE", "TEAM", "BUSINESS", "ENTERPRISE"]),
});

export const confirmPaymentSchema = z.object({
  paymentId: z.string().min(1),
});

function handleBillingError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error instanceof BillingPlanUsageError ? { details: error.details } : {}),
    });
    return;
  }
  next(error);
}

export async function getBillingSummaryController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const context = await resolveRequestWorkspaceContext(req.userId, req);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }

    const summary = await getBillingSummary(context.workspaceId, context.role, req.userId);
    res.json({ data: summary });
  } catch (error) {
    handleBillingError(error, res, next);
  }
}

export async function createPlanChangeController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const parsed = planChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid billing plan", issues: parsed.error.issues });
      return;
    }
    const context = await resolveRequestWorkspaceContext(req.userId, req);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }
    const result = await createBillingPlanChangeSession({
      userId: req.userId,
      workspaceId: context.workspaceId,
      role: context.role,
      targetPlan: parsed.data.plan,
    });
    res.json({ data: result });
  } catch (error) {
    handleBillingError(error, res, next);
  }
}

export async function confirmPaymentController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const parsed = confirmPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ message: "Invalid payment confirmation", issues: parsed.error.issues });
      return;
    }
    const context = await resolveRequestWorkspaceContext(req.userId, req);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }
    const result = await confirmBillingPayment({
      userId: req.userId,
      workspaceId: context.workspaceId,
      role: context.role,
      paymentId: parsed.data.paymentId,
    });
    res.json({ data: result });
  } catch (error) {
    handleBillingError(error, res, next);
  }
}

export async function yookassaWebhookController(req: Request, res: Response, next: NextFunction) {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body ?? {});
    const notification = JSON.parse(rawBody) as YooKassaNotification;
    await handleYooKassaNotification(notification);
    res.json({ received: true });
  } catch (error) {
    handleBillingError(error, res, next);
  }
}
