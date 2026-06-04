import type { NextFunction, Request, Response } from "express";

import { searchWorkspace } from "../services/search.service.js";
import { getUserWorkspaceContext } from "../services/workspace-context.service.js";

export async function searchWorkspaceController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const context = await getUserWorkspaceContext(req.userId);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }

    const query = typeof req.query.q === "string" ? req.query.q : "";

    const results = await searchWorkspace({
      workspaceId: context.workspaceId,
      userId: req.userId,
      role: context.role,
      query,
    });

    res.json({ data: results });
  } catch (error) {
    next(error);
  }
}
