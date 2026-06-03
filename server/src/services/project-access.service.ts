import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

export function isWorkspaceManager(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageProjects(role: WorkspaceRole): boolean {
  return isWorkspaceManager(role);
}

export function getAccessibleProjectWhere(
  userId: string,
  workspaceId: string,
  role: WorkspaceRole,
): Prisma.ProjectWhereInput {
  if (isWorkspaceManager(role)) {
    return { workspaceId };
  }

  return {
    workspaceId,
    projectMembers: {
      some: { userId },
    },
  };
}

export function getAccessibleTaskWhere(
  userId: string,
  workspaceId: string,
  role: WorkspaceRole,
): Prisma.TaskWhereInput {
  if (isWorkspaceManager(role)) {
    return { project: { workspaceId } };
  }

  return {
    project: {
      workspaceId,
      projectMembers: {
        some: { userId },
      },
    },
  };
}

export async function canAccessProject(
  userId: string,
  workspaceId: string,
  role: WorkspaceRole,
  projectId: string,
): Promise<boolean> {
  if (isWorkspaceManager(role)) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });
    return project !== null;
  }

  const membership = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId,
      project: { workspaceId },
    },
    select: { id: true },
  });

  return membership !== null;
}
