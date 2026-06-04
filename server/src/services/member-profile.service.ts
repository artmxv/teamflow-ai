import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";
import { getAccessibleProjectWhere, getAccessibleTaskWhere } from "./project-access.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

const TASK_LIMIT = 20;

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  avatarUrl: true,
  phone: true,
  position: true,
  location: true,
} as const;

export type GetMemberProfileInput = {
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceRole;
  memberId: string;
};

export async function getWorkspaceMemberProfile(input: GetMemberProfileInput) {
  const { workspaceId, actorUserId, actorRole, memberId } = input;

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: memberId,
      status: "ACTIVE",
    },
    select: {
      role: true,
      joinedAt: true,
      user: {
        select: userSelect,
      },
    },
  });

  if (!membership) {
    throw new AuthError("Workspace member not found", 404);
  }

  const accessibleProjectWhere = getAccessibleProjectWhere(actorUserId, workspaceId, actorRole);

  const projects = await prisma.project.findMany({
    where: {
      AND: [
        accessibleProjectWhere,
        {
          projectMembers: {
            some: { userId: memberId },
          },
        },
      ],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  const accessibleTaskWhere = getAccessibleTaskWhere(actorUserId, workspaceId, actorRole);

  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        accessibleTaskWhere,
        {
          taskAssignees: {
            some: { userId: memberId },
          },
        },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: TASK_LIMIT,
    select: {
      id: true,
      key: true,
      title: true,
      status: true,
      priority: true,
      projectId: true,
      dueDate: true,
      project: {
        select: { name: true },
      },
    },
  });

  return {
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    avatar: membership.user.avatar,
    avatarUrl: membership.user.avatarUrl,
    role: membership.role,
    joinedAt: membership.joinedAt.toISOString(),
    contact: {
      phone: membership.user.phone,
      position: membership.user.position,
      location: membership.user.location,
    },
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      key: task.key,
      title: task.title,
      status: task.status,
      priority: task.priority,
      projectId: task.projectId,
      projectName: task.project.name,
      dueDate: task.dueDate?.toISOString() ?? null,
    })),
  };
}
