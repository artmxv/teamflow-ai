import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  addProjectMember,
  getAvailableProjectMembers,
  getProjectMembers,
  removeProjectMember,
} from "../services/project-members.service.js";
import { canManageProjects } from "../services/project-access.service.js";
import { getUserWorkspaceContext } from "../services/workspace-context.service.js";

const addProjectMemberSchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

async function resolveWorkspace(req: Request, res: Response) {
  const context = await getUserWorkspaceContext(req.userId!);
  if (!context) {
    res.status(403).json({ message: "Workspace not found" });
    return null;
  }
  return context;
}

function parseProjectId(req: Request, res: Response) {
  const projectId = req.params.id;
  if (typeof projectId !== "string") {
    res.status(404).json({ message: "Project not found" });
    return null;
  }
  return projectId;
}

function parseMemberId(req: Request, res: Response) {
  const memberId = req.params.memberId;
  if (typeof memberId !== "string") {
    res.status(404).json({ message: "Project member not found" });
    return null;
  }
  return memberId;
}

export async function getProjectMembersController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const projectId = parseProjectId(req, res);
    if (!projectId) {
      return;
    }

    const members = await getProjectMembers(
      context.workspaceId,
      projectId,
      req.userId!,
      context.role,
    );
    if (members === null) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json({ data: members });
  } catch (error) {
    next(error);
  }
}

export async function getAvailableProjectMembersController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    if (!canManageProjects(context.role)) {
      res.status(403).json({
        message: "Project management is available to owners and admins.",
      });
      return;
    }

    const projectId = parseProjectId(req, res);
    if (!projectId) {
      return;
    }

    const users = await getAvailableProjectMembers(context.workspaceId, projectId);
    if (users === null) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json({ data: users });
  } catch (error) {
    next(error);
  }
}

export async function addProjectMemberController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    if (!canManageProjects(context.role)) {
      res.status(403).json({
        message: "Project management is available to owners and admins.",
      });
      return;
    }

    const projectId = parseProjectId(req, res);
    if (!projectId) {
      return;
    }

    const result = addProjectMemberSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid project member payload",
        issues: result.error.issues,
      });
      return;
    }

    const addResult = await addProjectMember(context.workspaceId, projectId, result.data.userId);

    if (!addResult.ok) {
      if (addResult.reason === "NOT_FOUND") {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      if (addResult.reason === "NOT_IN_WORKSPACE") {
        res.status(400).json({ message: "User is not an active member of this workspace" });
        return;
      }
      if (addResult.reason === "ALREADY_MEMBER") {
        res.status(409).json({ message: "User is already a member of this project" });
        return;
      }
      return;
    }

    res.status(201).json({ data: addResult.data });
  } catch (error) {
    next(error);
  }
}

export async function removeProjectMemberController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    if (!canManageProjects(context.role)) {
      res.status(403).json({
        message: "Project management is available to owners and admins.",
      });
      return;
    }

    const projectId = parseProjectId(req, res);
    if (!projectId) {
      return;
    }

    const memberId = parseMemberId(req, res);
    if (!memberId) {
      return;
    }

    const result = await removeProjectMember(context.workspaceId, projectId, memberId);
    if (!result) {
      res.status(404).json({ message: "Project member not found" });
      return;
    }

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
