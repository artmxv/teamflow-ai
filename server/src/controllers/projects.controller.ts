import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
} from "../services/projects.service.js";
import { canManageProjects } from "../services/project-access.service.js";
import { getUserWorkspaceContext } from "../services/workspace-context.service.js";

const createProjectSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  name: z.string().trim().min(2, "name must be at least 2 characters"),
  description: z.string().max(500, "description must be at most 500 characters").optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]).optional(),
  color: z.string().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters").optional(),
  description: z
    .string()
    .max(500, "description must be at most 500 characters")
    .nullable()
    .optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]).optional(),
  color: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

async function resolveWorkspace(req: Request, res: Response) {
  const context = await getUserWorkspaceContext(req.userId!);
  if (!context) {
    res.status(403).json({ message: "Workspace not found" });
    return null;
  }
  return context;
}

export async function getProjectsController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    const projects = await getProjects(context.workspaceId, req.userId!, context.role);
    res.json({ data: projects });
  } catch (error) {
    next(error);
  }
}

export async function createProjectController(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await resolveWorkspace(req, res);
    if (!context) {
      return;
    }

    if (!canManageProjects(context.role)) {
      res.status(403).json({
        message: "Only workspace owners and admins can create projects.",
      });
      return;
    }

    const result = createProjectSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Invalid project payload",
        issues: result.error.issues,
      });
      return;
    }

    const { workspaceId: _ignored, ...projectInput } = result.data;
    const project = await createProject({
      ...projectInput,
      workspaceId: context.workspaceId,
    });
    res.status(201).json({ data: project });
  } catch (error) {
    next(error);
  }
}

export async function updateProjectController(req: Request, res: Response, next: NextFunction) {
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

    const result = updateProjectSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid project payload",
        issues: result.error.issues,
      });
      return;
    }

    const projectId = req.params.id;
    if (typeof projectId !== "string") {
      res.status(404).json({
        message: "Project not found",
      });
      return;
    }

    const project = await updateProject(context.workspaceId, projectId, result.data);
    if (!project) {
      res.status(404).json({
        message: "Project not found",
      });
      return;
    }

    res.json({ data: project });
  } catch (error) {
    next(error);
  }
}

export async function deleteProjectController(req: Request, res: Response, next: NextFunction) {
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

    const projectId = req.params.id;
    if (typeof projectId !== "string") {
      res.status(404).json({
        message: "Project not found",
      });
      return;
    }

    const result = await deleteProject(context.workspaceId, projectId);

    if (!result) {
      res.status(404).json({
        message: "Project not found",
      });
      return;
    }

    if ("ok" in result && result.ok === false && result.reason === "HAS_TASKS") {
      res.status(409).json({
        message: "This project has tasks. Move or delete its tasks before deleting the project.",
      });
      return;
    }

    if ("id" in result) {
      res.json({ data: { id: result.id } });
    }
  } catch (error) {
    next(error);
  }
}
