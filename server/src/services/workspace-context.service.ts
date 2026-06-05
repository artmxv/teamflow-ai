import { Prisma, type BillingPlan } from "@prisma/client";

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
  plan: BillingPlan;
  role: WorkspaceRole;
};

export const WORKSPACE_SLUG_PATTERN = /^[a-z0-9-]+$/;

export type UpdateWorkspaceSettingsInput = {
  name: string;
  slug: string;
  industry?: string;
  teamSize?: string;
};

const workspaceSelect = {
  id: true,
  name: true,
  slug: true,
  industry: true,
  teamSize: true,
  plan: true,
} as const;

async function findActiveMembership(userId: string, selectedWorkspaceId?: string) {
  if (selectedWorkspaceId) {
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId: selectedWorkspaceId,
        status: "ACTIVE",
      },
      select: {
        role: true,
        workspaceId: true,
        workspace: { select: workspaceSelect },
      },
    });

    if (membership) {
      return membership;
    }
  }

  return prisma.workspaceMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      workspaceId: true,
      workspace: { select: workspaceSelect },
    },
  });
}

export async function getUserCurrentWorkspace(
  userId: string,
  selectedWorkspaceId?: string,
): Promise<AuthWorkspace | null> {
  const membership = await findActiveMembership(userId, selectedWorkspaceId);

  if (!membership) {
    return null;
  }

  return {
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    industry: membership.workspace.industry,
    teamSize: membership.workspace.teamSize,
    plan: membership.workspace.plan,
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

async function assertWorkspaceSlugAvailable(slug: string, workspaceId: string): Promise<void> {
  const existing = await prisma.workspace.findFirst({
    where: {
      slug,
      id: { not: workspaceId },
    },
    select: { id: true },
  });

  if (existing) {
    throw new AuthError("Slug is already taken", 409);
  }
}

export async function updateUserWorkspaceSettings(
  userId: string,
  input: UpdateWorkspaceSettingsInput,
  selectedWorkspaceId?: string,
): Promise<AuthWorkspace> {
  const context = await getUserWorkspaceContext(userId, selectedWorkspaceId);
  if (!context) {
    throw new AuthError("Workspace not found", 403);
  }

  if (context.role !== "OWNER") {
    throw new AuthError("Only workspace owners can edit workspace settings", 403);
  }

  const slug = input.slug.trim();
  if (!WORKSPACE_SLUG_PATTERN.test(slug)) {
    throw new AuthError("Slug can only contain lowercase letters, numbers, and hyphens", 400);
  }

  await assertWorkspaceSlugAvailable(slug, context.workspaceId);

  const data: Prisma.WorkspaceUpdateInput = {
    name: input.name.trim(),
    slug,
    industry: optionalStringToNull(input.industry),
    teamSize: optionalStringToNull(input.teamSize),
  };

  const workspace = await prisma.workspace.update({
    where: { id: context.workspaceId },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      industry: true,
      teamSize: true,
      plan: true,
    },
  });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    industry: workspace.industry,
    teamSize: workspace.teamSize,
    plan: workspace.plan,
    role: context.role,
  };
}

export async function getUserWorkspaceContext(
  userId: string,
  selectedWorkspaceId?: string,
): Promise<UserWorkspaceContext | null> {
  const membership = await findActiveMembership(userId, selectedWorkspaceId);

  if (!membership) {
    return null;
  }

  return {
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}
