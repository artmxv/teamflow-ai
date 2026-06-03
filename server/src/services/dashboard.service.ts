import { prisma } from "../lib/prisma.js";
import { getAccessibleProjectWhere, getAccessibleTaskWhere } from "./project-access.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;

export async function getDashboardSummary(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
) {
  const projectWhere = getAccessibleProjectWhere(userId, workspaceId, role);
  const taskWhere = getAccessibleTaskWhere(userId, workspaceId, role);

  const [activeProjects, openTasks, completedTasks, teamMembers, statusGroups, recentTasks] =
    await Promise.all([
      prisma.project.count({ where: { ...projectWhere, status: "ACTIVE" } }),
      prisma.task.count({ where: { ...taskWhere, status: { not: "DONE" } } }),
      prisma.task.count({ where: { ...taskWhere, status: "DONE" } }),
      prisma.workspaceMember.count({ where: { workspaceId, status: "ACTIVE" } }),
      prisma.task.groupBy({
        by: ["status"],
        where: taskWhere,
        _count: { status: true },
      }),
      prisma.task.findMany({
        where: taskWhere,
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

  const countByStatus = new Map(statusGroups.map((group) => [group.status, group._count.status]));

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
