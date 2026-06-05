import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { AuthError, getUserById } from "../services/auth.service.js";
import { resolveRequestWorkspaceContext } from "../lib/workspace-request.js";
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  getInvitationByToken,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from "../services/workspace-invitations.service.js";

const createInvitationSchema = z.object({
  email: z.string().trim().email("email must be valid"),
  role: z.enum(["ADMIN", "MEMBER"]),
});

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function handleInvitationError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
    return;
  }
  next(error);
}

export async function listWorkspaceInvitationsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
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

    const invitations = await listWorkspaceInvitations(context.workspaceId, context.role);
    res.json({ data: invitations });
  } catch (error) {
    handleInvitationError(error, res, next);
  }
}

export async function createWorkspaceInvitationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const result = createInvitationSchema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      res.status(400).json({
        message: firstIssue?.message ?? "Invalid invitation payload",
        issues: result.error.issues,
      });
      return;
    }

    const context = await resolveRequestWorkspaceContext(req.userId, req);
    if (!context) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: context.workspaceId },
      select: { name: true, plan: true },
    });

    if (!workspace) {
      res.status(403).json({ message: "Workspace not found" });
      return;
    }

    const created = await createWorkspaceInvitation({
      workspaceId: context.workspaceId,
      workspaceName: workspace.name,
      workspacePlan: workspace.plan,
      inviterUserId: req.userId,
      inviterRole: context.role,
      email: result.data.email,
      role: result.data.role,
    });

    res.status(created.reused ? 200 : 201).json({
      data: {
        invitation: created.invitation,
        deliveryMode: created.deliveryMode,
        emailSent: created.emailSent,
        ...(created.emailWarning ? { emailWarning: created.emailWarning } : {}),
        acceptUrl: created.invitation.acceptUrl,
      },
    });
  } catch (error) {
    handleInvitationError(error, res, next);
  }
}

export async function revokeWorkspaceInvitationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
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

    const invitation = await revokeWorkspaceInvitation(
      context.workspaceId,
      routeParam(req.params.id),
      context.role,
    );
    res.json({ data: invitation });
  } catch (error) {
    handleInvitationError(error, res, next);
  }
}

export async function getInvitationPreviewController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = routeParam(req.params.token).trim();
    if (!token) {
      res.status(400).json({ message: "Invitation token is required" });
      return;
    }

    let currentUser = null;
    if (req.userId) {
      currentUser = await getUserById(req.userId);
    }

    const preview = await getInvitationByToken(token, currentUser);
    res.json({ data: preview });
  } catch (error) {
    handleInvitationError(error, res, next);
  }
}

export async function acceptInvitationController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const token = routeParam(req.params.token).trim();
    if (!token) {
      res.status(400).json({ message: "Invitation token is required" });
      return;
    }

    const user = await getUserById(req.userId);
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const result = await acceptWorkspaceInvitation(token, user);
    res.json({ data: result });
  } catch (error) {
    handleInvitationError(error, res, next);
  }
}
