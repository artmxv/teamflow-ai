import type { NextFunction, Request, Response } from "express";

import { getWorkspaceAiSummary } from "../services/ai.service.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";

function normalizeAiResponseText(value: string): string {
  return value
    .replace(/(\d+)(completed tasks?)/g, "$1 $2")
    .replace(/\.(?=[A-Z])/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getWorkspaceAiSummaryController(
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

    const summary = await getWorkspaceAiSummary(context.workspaceId);
    res.json({
      data: {
        ...summary,
        overview: normalizeAiResponseText(summary.overview),
        highlights: summary.highlights.map(normalizeAiResponseText),
        risks: summary.risks.map(normalizeAiResponseText),
        recommendedNextActions: summary.recommendedNextActions.map(normalizeAiResponseText),
        standupSummary: normalizeAiResponseText(summary.standupSummary),
      },
    });
  } catch (error) {
    next(error);
  }
}
