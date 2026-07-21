import type { IncomingHttpHeaders } from "node:http";

import { AuthError, verifyAuthToken } from "../services/auth.service.js";
import { prisma } from "../lib/prisma.js";
import { validateActiveWorkspaceMembership } from "../lib/socket-membership-utils.js";

export type SocketAuthInput = {
  auth?: Record<string, unknown>;
  headers?: IncomingHttpHeaders;
};

export type ParsedSocketCredentials = {
  token: string | null;
  workspaceId: string | null;
};

/**
 * Extract JWT for Socket.IO handshake.
 * Primary path matches REST: Bearer token (handshake.auth.token or Authorization).
 * Cookie is a secondary fallback if present (project currently stores JWT in localStorage).
 */
export function parseSocketCredentials(input: SocketAuthInput): ParsedSocketCredentials {
  const authToken =
    typeof input.auth?.token === "string" && input.auth.token.trim()
      ? input.auth.token.trim()
      : null;

  const workspaceId =
    typeof input.auth?.workspaceId === "string" && input.auth.workspaceId.trim()
      ? input.auth.workspaceId.trim()
      : null;

  if (authToken) {
    return { token: authToken, workspaceId };
  }

  const header = input.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const bearer = header.slice("Bearer ".length).trim();
    if (bearer) {
      return { token: bearer, workspaceId };
    }
  }

  const cookieHeader = input.headers?.cookie;
  if (typeof cookieHeader === "string" && cookieHeader.length > 0) {
    const cookieToken = readCookieValue(cookieHeader, "teamflow_auth_token");
    if (cookieToken) {
      return { token: cookieToken, workspaceId };
    }
  }

  return { token: null, workspaceId };
}

export function readCookieValue(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (key !== name) {
      continue;
    }
    const raw = trimmed.slice(eq + 1).trim();
    if (!raw) {
      return null;
    }
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export function authenticateSocketToken(token: string | null): string {
  if (!token) {
    throw new AuthError("Unauthorized", 401);
  }
  return verifyAuthToken(token);
}

/**
 * Validates workspace membership for socket.data.
 * Rejects missing workspace, inactive membership, and cross-workspace access.
 */
export async function resolveSocketWorkspaceMembership(
  userId: string,
  workspaceId: string | null,
): Promise<{ userId: string; workspaceId: string } | "missing_workspace" | "forbidden"> {
  if (!workspaceId) {
    return "missing_workspace";
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId,
      status: "ACTIVE",
    },
    select: {
      userId: true,
      workspaceId: true,
      status: true,
    },
  });

  const verdict = validateActiveWorkspaceMembership({
    userId,
    workspaceId,
    memberships: membership
      ? [{ userId: membership.userId, workspaceId: membership.workspaceId, status: membership.status }]
      : [],
  });

  if (verdict === "missing_workspace") {
    return "missing_workspace";
  }
  if (verdict === "forbidden") {
    return "forbidden";
  }

  return {
    userId,
    workspaceId,
  };
}
