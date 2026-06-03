import { prisma } from "../lib/prisma.js";

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

export async function getWorkspaceMembers(workspaceId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
    },
    orderBy: { user: { name: "asc" } },
    select: {
      role: true,
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
    role: membership.role,
  }));
}
