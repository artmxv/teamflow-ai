import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AuthError } from "../services/auth.service.js";
import {
  getSelectedWorkspaceIdFromRequest,
  resolveRequestCurrentWorkspace,
} from "../lib/workspace-request.js";
import {
  createWorkspaceForUser,
  deleteWorkspaceForUser,
  listUserWorkspaces,
  validateWorkspaceSwitch,
} from "../services/workspaces.service.js";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
  teamSize: z.string().trim().optional(),
});

const switchWorkspaceSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
});

function handleWorkspacesError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
    return;
  }
  next(error);
}

export async function listWorkspacesController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const currentWorkspace = await resolveRequestCurrentWorkspace(req.userId, req);
    const workspaces = await listUserWorkspaces(req.userId, currentWorkspace?.id);
    res.json({ data: workspaces });
  } catch (error) {
    handleWorkspacesError(error, res, next);
  }
}

export async function createWorkspaceController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const parsed = createWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        message: firstIssue?.message ?? "Invalid workspace payload",
        issues: parsed.error.issues,
      });
      return;
    }

    const selectedWorkspaceId = getSelectedWorkspaceIdFromRequest(req);
    const workspace = await createWorkspaceForUser({
      userId: req.userId,
      selectedWorkspaceId,
      data: parsed.data,
    });

    res.status(201).json({ data: workspace });
  } catch (error) {
    handleWorkspacesError(error, res, next);
  }
}

export async function deleteWorkspaceController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const workspaceId = req.params.workspaceId;
    if (!workspaceId || typeof workspaceId !== "string") {
      res.status(400).json({ message: "workspaceId is required" });
      return;
    }

    const result = await deleteWorkspaceForUser(req.userId, workspaceId);
    res.json({ data: result });
  } catch (error) {
    handleWorkspacesError(error, res, next);
  }
}

export async function switchWorkspaceController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const parsed = switchWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        message: firstIssue?.message ?? "Invalid workspace switch payload",
        issues: parsed.error.issues,
      });
      return;
    }

    const workspace = await validateWorkspaceSwitch(req.userId, parsed.data.workspaceId);
    res.json({ data: workspace });
  } catch (error) {
    handleWorkspacesError(error, res, next);
  }
}
