import type { WorkspaceRole } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AuthError } from "./auth.service.js";

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  avatarUrl: true,
} as const;

const manageableRoles = ["ADMIN", "MEMBER"] as const;
type ManageableRole = (typeof manageableRoles)[number];

function assertOwner(actorRole: WorkspaceRole): void {
  if (actorRole !== "OWNER") {
    throw new AuthError("Only workspace owners can manage members", 403);
  }
}

function assertManageableRole(role: WorkspaceRole): asserts role is ManageableRole {
  if (!manageableRoles.includes(role as ManageableRole)) {
    throw new AuthError("Owner role cannot be assigned here", 400);
  }
}

async function countActiveOwners(workspaceId: string): Promise<number> {
  return prisma.workspaceMember.count({
    where: {
      workspaceId,
      status: "ACTIVE",
      role: "OWNER",
    },
  });
}

async function findActiveMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      status: "ACTIVE",
    },
    select: {
      role: true,
      user: {
        select: userSelect,
      },
    },
  });
}

export async function getWorkspaceMembers(workspaceId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
    },
    orderBy: { user: { name: "asc" } },
    select: {
      role: true,
      joinedAt: true,
      user: {
        select: userSelect,
      },
    },
  });

  return memberships.map((membership) => ({
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    avatar: membership.user.avatar,
    avatarUrl: membership.user.avatarUrl,
    role: membership.role,
    joinedAt: membership.joinedAt.toISOString(),
  }));
}

export type UpdateWorkspaceMemberRoleInput = {
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceRole;
  memberId: string;
  role: WorkspaceRole;
};

export async function updateWorkspaceMemberRole(input: UpdateWorkspaceMemberRoleInput) {
  const { workspaceId, actorUserId, actorRole, memberId, role } = input;

  assertOwner(actorRole);

  if (actorUserId === memberId) {
    throw new AuthError("You cannot change your own role", 403);
  }

  assertManageableRole(role);

  const membership = await findActiveMembership(workspaceId, memberId);
  if (!membership) {
    throw new AuthError("Workspace member not found", 404);
  }

  if (membership.role === "OWNER") {
    const ownerCount = await countActiveOwners(workspaceId);
    if (ownerCount <= 1) {
      throw new AuthError("Cannot demote the last owner", 409);
    }
  }

  if (membership.role === role) {
    return {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      avatar: membership.user.avatar,
      avatarUrl: membership.user.avatarUrl,
      role: membership.role,
    };
  }

  const updated = await prisma.workspaceMember.update({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: memberId,
      },
    },
    data: { role },
    select: {
      role: true,
      user: {
        select: userSelect,
      },
    },
  });

  return {
    id: updated.user.id,
    name: updated.user.name,
    email: updated.user.email,
    avatar: updated.user.avatar,
    avatarUrl: updated.user.avatarUrl,
    role: updated.role,
  };
}

export type RemoveWorkspaceMemberInput = {
  workspaceId: string;
  actorUserId: string;
  actorRole: WorkspaceRole;
  memberId: string;
};

export async function removeWorkspaceMember(input: RemoveWorkspaceMemberInput) {
  const { workspaceId, actorUserId, actorRole, memberId } = input;

  assertOwner(actorRole);

  if (actorUserId === memberId) {
    throw new AuthError("You cannot remove yourself", 403);
  }

  const membership = await findActiveMembership(workspaceId, memberId);
  if (!membership) {
    throw new AuthError("Workspace member not found", 404);
  }

  if (membership.role === "OWNER") {
    const ownerCount = await countActiveOwners(workspaceId);
    if (ownerCount <= 1) {
      throw new AuthError("Cannot remove the last owner", 409);
    }
  }

  await prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const projectIds = projects.map((project) => project.id);

    if (projectIds.length > 0) {
      await tx.taskAssignee.deleteMany({
        where: {
          userId: memberId,
          task: { projectId: { in: projectIds } },
        },
      });

      await tx.task.updateMany({
        where: {
          assigneeId: memberId,
          projectId: { in: projectIds },
        },
        data: { assigneeId: null },
      });

      await tx.projectMember.deleteMany({
        where: {
          userId: memberId,
          projectId: { in: projectIds },
        },
      });
    }

    await tx.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberId,
        },
      },
    });
  });

  return { id: memberId };
}
