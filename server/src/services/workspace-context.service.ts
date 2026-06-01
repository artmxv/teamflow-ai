import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export type UserWorkspaceContext = {
  workspaceId: string;
  role: WorkspaceRole;
};

export type AuthWorkspace = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  teamSize: string | null;
  role: WorkspaceRole;
};

export type UpdateWorkspaceSettingsInput = {
  name?: string;
  industry?: string;
  teamSize?: string;
};

export async function getUserCurrentWorkspace(userId: string): Promise<AuthWorkspace | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          industry: true,
          teamSize: true,
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    industry: membership.workspace.industry,
    teamSize: membership.workspace.teamSize,
    role: membership.role,
  };
}

function optionalStringToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function updateUserWorkspaceSettings(
  userId: string,
  input: UpdateWorkspaceSettingsInput,
): Promise<AuthWorkspace> {
  const context = await getUserWorkspaceContext(userId);
  if (!context) {
    throw new AuthError("Workspace not found", 403);
  }

  const data: Prisma.WorkspaceUpdateInput = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.industry !== undefined) {
    data.industry = optionalStringToNull(input.industry);
  }
  if (input.teamSize !== undefined) {
    data.teamSize = optionalStringToNull(input.teamSize);
  }

  const workspace = await prisma.workspace.update({
    where: { id: context.workspaceId },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      industry: true,
      teamSize: true,
    },
  });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    industry: workspace.industry,
    teamSize: workspace.teamSize,
    role: context.role,
  };
}

export async function getUserWorkspaceContext(
  userId: string,
): Promise<UserWorkspaceContext | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      workspaceId: true,
    },
  });

  if (!membership) {
    return null;
  }

  return {
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}
