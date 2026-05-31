import type { NextFunction, Request, Response } from "express";

import { getProjects } from "../services/projects.service.js";

export async function getProjectsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const projects = await getProjects();
    res.json({ data: projects });
  } catch (error) {
    next(error);
  }
}
