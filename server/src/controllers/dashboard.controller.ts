import type { NextFunction, Request, Response } from "express";

import { getDashboardSummary } from "../services/dashboard.service.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";

export async function getDashboardSummaryController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveRequestWorkspaceContext(req.userId!, req);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }

    const summary = await getDashboardSummary(context.workspaceId, req.userId!, context.role);
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
}
