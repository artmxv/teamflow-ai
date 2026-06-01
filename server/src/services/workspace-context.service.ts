import { prisma } from "../lib/prisma.js";

export type UserWorkspaceContext = {
  workspaceId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

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
