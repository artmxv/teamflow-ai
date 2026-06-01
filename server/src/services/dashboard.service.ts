import { prisma } from "../lib/prisma.js";

const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;

export async function getDashboardSummary() {
  const [
    activeProjects,
    openTasks,
    completedTasks,
    teamMembers,
    statusGroups,
    recentTasks,
  ] = await Promise.all([
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.task.count({ where: { status: { not: "DONE" } } }),
    prisma.task.count({ where: { status: "DONE" } }),
    prisma.workspaceMember.count({ where: { status: "ACTIVE" } }),
    prisma.task.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.task.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    }),
  ]);

  const countByStatus = new Map(
    statusGroups.map((group) => [group.status, group._count.status]),
  );

  const taskStatusCounts = TASK_STATUSES.map((status) => ({
    status,
    count: countByStatus.get(status) ?? 0,
  }));

  return {
    activeProjects,
    openTasks,
    completedTasks,
    teamMembers,
    taskStatusCounts,
    recentTasks,
  };
}
