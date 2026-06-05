import { prisma } from "../lib/prisma.js";
import { notifyProjectMemberAdded } from "./notifications.service.js";
import { canAccessProject } from "./project-access.service.js";
import { findProjectInWorkspace } from "./projects.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  avatarUrl: true,
} as const;

const projectMemberSelect = {
  id: true,
  role: true,
  createdAt: true,
  user: {
    select: userSelect,
  },
} as const;

type ProjectMemberRecord = {
  id: string;
  role: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    avatarUrl: string | null;
  };
};

function mapProjectMember(member: ProjectMemberRecord) {
  return {
    id: member.id,
    role: member.role,
    createdAt: member.createdAt,
    user: member.user,
  };
}

export async function getProjectMembers(
  workspaceId: string,
  projectId: string,
  userId: string,
  role: WorkspaceRole,
) {
  const hasAccess = await canAccessProject(userId, workspaceId, role, projectId);
  if (!hasAccess) {
    return null;
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: projectMemberSelect,
  });

  return members.map(mapProjectMember);
}

export async function getAvailableProjectMembers(workspaceId: string, projectId: string) {
  const project = await findProjectInWorkspace(projectId, workspaceId);
  if (!project) {
    return null;
  }

  const existingMembers = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const excludeUserIds = existingMembers.map((member) => member.userId);

  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
      userId: excludeUserIds.length > 0 ? { notIn: excludeUserIds } : undefined,
    },
    orderBy: { user: { name: "asc" } },
    select: {
      user: {
        select: userSelect,
      },
    },
  });

  return workspaceMembers.map((membership) => membership.user);
}

export type AddProjectMemberResult =
  | { ok: true; data: ReturnType<typeof mapProjectMember> }
  | { ok: false; reason: "NOT_FOUND" | "NOT_IN_WORKSPACE" | "ALREADY_MEMBER" };

export async function addProjectMember(
  workspaceId: string,
  projectId: string,
  userId: string,
  actorId?: string,
): Promise<AddProjectMemberResult> {
  const project = await findProjectInWorkspace(projectId, workspaceId);
  if (!project) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!workspaceMember) {
    return { ok: false, reason: "NOT_IN_WORKSPACE" };
  }

  const existing = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { ok: false, reason: "ALREADY_MEMBER" };
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId,
      role: "MEMBER",
    },
    select: projectMemberSelect,
  });

  if (actorId) {
    void notifyProjectMemberAdded({
      workspaceId,
      projectId,
      projectName: project.name,
      memberUserId: userId,
      actorId,
    });
  }

  return { ok: true, data: mapProjectMember(member) };
}

export async function removeProjectMember(
  workspaceId: string,
  projectId: string,
  memberId: string,
): Promise<{ id: string } | null> {
  const project = await findProjectInWorkspace(projectId, workspaceId);
  if (!project) {
    return null;
  }

  const member = await prisma.projectMember.findFirst({
    where: {
      id: memberId,
      projectId,
    },
    select: { id: true },
  });

  if (!member) {
    return null;
  }

  await prisma.projectMember.delete({
    where: { id: memberId },
  });

  return { id: memberId };
}
