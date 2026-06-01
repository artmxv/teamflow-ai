import { prisma } from "../lib/prisma.js";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export type UserWorkspaceContext = {
  workspaceId: string;
  role: WorkspaceRole;
};

export type AuthWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
};

export async function getUserCurrentWorkspace(
  userId: string,
): Promise<AuthWorkspace | null> {
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
    role: membership.role,
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
