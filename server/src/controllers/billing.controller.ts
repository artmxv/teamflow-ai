import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AuthError } from "../services/auth.service.js";
import { getBillingSummary, updateWorkspaceBillingPlan } from "../services/billing.service.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";

export const updatePlanSchema = z.object({
  plan: z.enum(["FREE", "TEAM", "BUSINESS", "ENTERPRISE"]),
});

function handleBillingError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
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

    const summary = await getBillingSummary(req.userId, context.workspaceId);
    res.json({ data: summary });
  } catch (error) {
    handleBillingError(error, res, next);
  }
}

export async function updateBillingPlanController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const parsed = updatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        message: firstIssue?.message ?? "Invalid billing plan payload",
        issues: parsed.error.issues,
      });
      return;
    }

    const context = await resolveRequestWorkspaceContext(req.userId, req);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }

    const summary = await updateWorkspaceBillingPlan({
      userId: req.userId,
      workspaceId: context.workspaceId,
      role: context.role,
      plan: parsed.data.plan,
    });

    res.json({ data: summary });
  } catch (error) {
    handleBillingError(error, res, next);
  }
}
