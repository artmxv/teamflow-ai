import type { BillingPlan } from "@prisma/client";

import { ensureUserInWorkspaceGeneralConversation } from "../lib/chat-conversation-ensure.js";
import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import {
  countUserWorkspaces,
  getBillingPlanConfig,
  lockUserWorkspaceUsage,
  lockWorkspaceBillingUsage,
  WORKSPACE_LIMIT_REACHED_CODE,
} from "./billing-plans.service.js";
import {
  getUserCurrentWorkspace,
  WORKSPACE_SLUG_PATTERN,
  type WorkspaceRole,
} from "./workspace-context.service.js";

export type WorkspaceListItem = {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  role: WorkspaceRole;
  plan: BillingPlan;
  teamSize: string | null;
  createdAt: Date;
};

export type CreateWorkspaceInput = {
  name: string;
  slug?: string;
  teamSize?: string;
};

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "workspace";
}

async function createUniqueWorkspaceSlug(base: string): Promise<string> {
  const slug = slugify(base);
  let candidate = slug;
  let suffix = 0;

  while (await prisma.workspace.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${slug}-${suffix}`;
  }

  return candidate;
}

function optionalStringToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function assertCanCreateWorkspace(
  plan: BillingPlan,
  ownedCount: number,
): Promise<void> {
  const { limits } = getBillingPlanConfig(plan);
  if (limits.maxWorkspaces === null) {
    return;
  }

  if (ownedCount >= limits.maxWorkspaces) {
    throw new AuthError(
      "Workspace limit reached for your current plan",
      409,
      WORKSPACE_LIMIT_REACHED_CODE,
    );
  }
}

export async function listUserWorkspaces(
  userId: string,
  currentWorkspaceId?: string,
): Promise<WorkspaceListItem[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
      status: "ACTIVE",
    },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          teamSize: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ workspace: { name: "asc" } }, { workspace: { createdAt: "desc" } }],
  });

  const items = memberships.map((membership) => ({
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    avatar: null,
    role: membership.role,
    plan: membership.workspace.plan,
    teamSize: membership.workspace.teamSize,
    createdAt: membership.workspace.createdAt,
  }));

  if (!currentWorkspaceId) {
    return items;
  }

  return items.sort((a, b) => {
    if (a.id === currentWorkspaceId) return -1;
    if (b.id === currentWorkspaceId) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function createWorkspaceForUser(input: {
  userId: string;
  selectedWorkspaceId?: string;
  data: CreateWorkspaceInput;
}): Promise<WorkspaceListItem> {
  const currentWorkspace = await getUserCurrentWorkspace(input.userId, input.selectedWorkspaceId);
  if (!currentWorkspace) {
    throw new AuthError("Workspace not found", 403);
  }

  if (currentWorkspace.role !== "OWNER") {
    throw new AuthError("You do not have permission to create workspaces from this workspace", 403);
  }

  const name = input.data.name.trim();
  let slug: string;

  if (input.data.slug?.trim()) {
    slug = input.data.slug.trim();
    if (!WORKSPACE_SLUG_PATTERN.test(slug)) {
      throw new AuthError("Slug can only contain lowercase letters, numbers, and hyphens", 400);
    }

    const existing = await prisma.workspace.findUnique({ where: { slug } });
    if (existing) {
      throw new AuthError("This workspace address is already taken", 409);
    }
  } else {
    slug = await createUniqueWorkspaceSlug(name);
  }

  const workspace = await prisma.$transaction(async (tx) => {
    await lockWorkspaceBillingUsage(tx, currentWorkspace.id);
    await lockUserWorkspaceUsage(tx, input.userId);

    const billingWorkspace = await tx.workspace.findUnique({
      where: { id: currentWorkspace.id },
      select: { plan: true },
    });
    if (!billingWorkspace) {
      throw new AuthError("Workspace not found", 403);
    }

    const ownedCount = await countUserWorkspaces(input.userId, tx);
    await assertCanCreateWorkspace(billingWorkspace.plan, ownedCount);

    const created = await tx.workspace.create({
      data: {
        name,
        slug,
        teamSize: optionalStringToNull(input.data.teamSize) ?? null,
        plan: "FREE",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        teamSize: true,
        createdAt: true,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: created.id,
        userId: input.userId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    await ensureUserInWorkspaceGeneralConversation(tx, created.id, input.userId);

    return created;
  });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    avatar: null,
    role: "OWNER",
    plan: workspace.plan,
    teamSize: workspace.teamSize,
    createdAt: workspace.createdAt,
  };
}

async function findFallbackWorkspaceForUser(userId: string): Promise<WorkspaceListItem | null> {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
      status: "ACTIVE",
    },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          teamSize: true,
          createdAt: true,
        },
      },
    },
  });

  if (memberships.length === 0) {
    return null;
  }

  const sorted = memberships.sort((a, b) => {
    if (a.role === "OWNER" && b.role !== "OWNER") return -1;
    if (b.role === "OWNER" && a.role !== "OWNER") return 1;
    return b.workspace.createdAt.getTime() - a.workspace.createdAt.getTime();
  });

  const pick = sorted[0];
  return {
    id: pick.workspace.id,
    name: pick.workspace.name,
    slug: pick.workspace.slug,
    avatar: null,
    role: pick.role,
    plan: pick.workspace.plan,
    teamSize: pick.workspace.teamSize,
    createdAt: pick.workspace.createdAt,
  };
}

export async function deleteWorkspaceForUser(
  userId: string,
  workspaceId: string,
): Promise<{
  deletedWorkspaceId: string;
  fallbackWorkspace: WorkspaceListItem | null;
}> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    throw new AuthError("Workspace not found", 404);
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId,
      status: "ACTIVE",
    },
    select: { role: true },
  });

  if (!membership) {
    throw new AuthError("Workspace not found", 404);
  }

  if (membership.role !== "OWNER") {
    throw new AuthError("Only the owner can delete this workspace", 403);
  }

  const ownedCount = await countUserWorkspaces(userId);
  if (ownedCount <= 1) {
    throw new AuthError(
      "You cannot delete your last workspace",
      409,
      "LAST_WORKSPACE_CANNOT_BE_DELETED",
    );
  }

  await prisma.workspace.delete({
    where: { id: workspaceId },
  });

  const fallbackWorkspace = await findFallbackWorkspaceForUser(userId);

  return {
    deletedWorkspaceId: workspaceId,
    fallbackWorkspace,
  };
}

export async function validateWorkspaceSwitch(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceListItem> {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId,
      status: "ACTIVE",
    },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          teamSize: true,
          createdAt: true,
        },
      },
    },
  });

  if (!membership) {
    throw new AuthError("Workspace not found", 403);
  }

  return {
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    avatar: null,
    role: membership.role,
    plan: membership.workspace.plan,
    teamSize: membership.workspace.teamSize,
    createdAt: membership.workspace.createdAt,
  };
}
