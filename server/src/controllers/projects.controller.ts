import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { createProject, getProjects } from "../services/projects.service.js";
import { getUserWorkspaceContext } from "../services/workspace-context.service.js";

const createProjectSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  name: z.string().trim().min(2, "name must be at least 2 characters"),
  description: z.string().max(500, "description must be at most 500 characters").optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]).optional(),
  color: z.string().optional(),
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

    const projects = await getProjects(context.workspaceId);
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
