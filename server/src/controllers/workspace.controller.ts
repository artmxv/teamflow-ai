import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AuthError } from "../services/auth.service.js";
import {
  getUserCurrentWorkspace,
  getUserWorkspaceContext,
  updateUserWorkspaceSettings,
} from "../services/workspace-context.service.js";
import {
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from "../services/workspace-members.service.js";

const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "name cannot be empty"),
  slug: z
    .string()
    .trim()
    .min(1, "slug cannot be empty")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  industry: z.string().trim().optional(),
  teamSize: z.string().trim().optional(),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"], {
    message: "role must be ADMIN or MEMBER",
  }),
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

export async function updateWorkspaceMemberRoleController(
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

    const memberId = req.params.memberId;
    if (!memberId || typeof memberId !== "string") {
      res.status(400).json({ message: "memberId is required" });
      return;
    }

    const parsed = updateMemberRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        message: firstIssue?.message ?? "Invalid role payload",
        issues: parsed.error.issues,
      });
      return;
    }

    const member = await updateWorkspaceMemberRole({
      workspaceId: context.workspaceId,
      actorUserId: req.userId,
      actorRole: context.role,
      memberId,
      role: parsed.data.role,
    });

    res.json({ data: member });
  } catch (error) {
    handleWorkspaceError(error, res, next);
  }
}

export async function removeWorkspaceMemberController(
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

    const memberId = req.params.memberId;
    if (!memberId || typeof memberId !== "string") {
      res.status(400).json({ message: "memberId is required" });
      return;
    }

    const result = await removeWorkspaceMember({
      workspaceId: context.workspaceId,
      actorUserId: req.userId,
      actorRole: context.role,
      memberId,
    });

    res.json({ data: result });
  } catch (error) {
    handleWorkspaceError(error, res, next);
  }
}

export async function getWorkspaceSettingsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const workspace = await getUserCurrentWorkspace(req.userId);
    if (!workspace) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }

    res.json({ data: { workspace } });
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
