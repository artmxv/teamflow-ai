import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { createProject, getProjects } from "../services/projects.service.js";

const createProjectSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  name: z.string().trim().min(2, "name must be at least 2 characters"),
  description: z.string().max(500, "description must be at most 500 characters").optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]).optional(),
  color: z.string().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function getProjectsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const projects = await getProjects();
    res.json({ data: projects });
  } catch (error) {
    next(error);
  }
}

export async function createProjectController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = createProjectSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Invalid project payload",
        issues: result.error.issues,
      });
      return;
    }

    const project = await createProject(result.data);
    res.status(201).json({ data: project });
  } catch (error) {
    next(error);
  }
}
