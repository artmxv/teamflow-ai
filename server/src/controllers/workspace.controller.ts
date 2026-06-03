import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AuthError } from "../services/auth.service.js";
import {
  getUserWorkspaceContext,
  updateUserWorkspaceSettings,
} from "../services/workspace-context.service.js";
import { getWorkspaceMembers } from "../services/workspace-members.service.js";

const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1, "name cannot be empty").optional(),
    industry: z.string().trim().optional(),
    teamSize: z.string().trim().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field is required",
  });

function handleWorkspaceError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  next(error);
}

export async function getWorkspaceMembersController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
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

    const members = await getWorkspaceMembers(context.workspaceId);
    res.json({ data: members });
  } catch (error) {
    handleWorkspaceError(error, res, next);
  }
}

export async function updateWorkspaceController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const result = updateWorkspaceSchema.safeParse(req.body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      res.status(400).json({
        message: firstIssue?.message ?? "Invalid workspace payload",
        issues: result.error.issues,
      });
      return;
    }

    const workspace = await updateUserWorkspaceSettings(req.userId, result.data);
    res.json({ data: { workspace } });
  } catch (error) {
    handleWorkspaceError(error, res, next);
  }
}
