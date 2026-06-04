import type { NextFunction, Request, Response } from "express";

import { verifyAuthToken } from "../services/auth.service.js";

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    next();
    return;
  }

  try {
    req.userId = verifyAuthToken(token);
  } catch {
    // Invalid token is ignored for public preview routes.
  }

  next();
}
