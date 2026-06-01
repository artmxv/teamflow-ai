import type { NextFunction, Request, Response } from "express";

import { getDashboardSummary } from "../services/dashboard.service.js";

export async function getDashboardSummaryController(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const summary = await getDashboardSummary();
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
}
