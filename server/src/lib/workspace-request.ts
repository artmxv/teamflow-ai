import type { Request } from "express";

import {
  getUserCurrentWorkspace,
  getUserWorkspaceContext,
  type AuthWorkspace,
  type UserWorkspaceContext,
} from "../services/workspace-context.service.js";

export const WORKSPACE_ID_HEADER = "x-workspace-id";

export function getSelectedWorkspaceIdFromRequest(req: Request): string | undefined {
  const header = req.headers[WORKSPACE_ID_HEADER];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  if (Array.isArray(header) && header[0]?.trim()) {
    return header[0].trim();
  }
  return undefined;
}

export async function resolveRequestWorkspaceContext(
  userId: string,
  req: Request,
): Promise<UserWorkspaceContext | null> {
  const selectedWorkspaceId = getSelectedWorkspaceIdFromRequest(req);
  return getUserWorkspaceContext(userId, selectedWorkspaceId);
}

export async function resolveRequestCurrentWorkspace(
  userId: string,
  req: Request,
): Promise<AuthWorkspace | null> {
  const selectedWorkspaceId = getSelectedWorkspaceIdFromRequest(req);
  return getUserCurrentWorkspace(userId, selectedWorkspaceId);
}
