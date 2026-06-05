import { prisma } from "../lib/prisma.js";
import { getAccessibleProjectWhere, getAccessibleTaskWhere } from "./project-access.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;

const assigneeUserSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  avatarUrl: true,
} as const;

function mapRecentTaskAssignees(task: {
  assignee: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    avatarUrl: string | null;
  } | null;
  taskAssignees: {
    user: {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
      avatarUrl: string | null;
    };
  }[];
}) {
  const fromJoin = task.taskAssignees.map((link) => link.user);
  if (fromJoin.length > 0) {
    return fromJoin;
  }
  return task.assignee ? [task.assignee] : [];
}

export async function getDashboardSummary(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
) {
  const projectWhere = getAccessibleProjectWhere(userId, workspaceId, role);
  const taskWhere = getAccessibleTaskWhere(userId, workspaceId, role);

  const [activeProjects, openTasks, completedTasks, teamMembers, statusGroups, recentTasksRaw] =
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
            select: assigneeUserSelect,
          },
          taskAssignees: {
            orderBy: { createdAt: "asc" },
            select: {
              user: {
                select: assigneeUserSelect,
              },
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

  const recentTasks = recentTasksRaw.map((task) => {
    const assignees = mapRecentTaskAssignees(task);
    return {
      id: task.id,
      key: task.key,
      title: task.title,
      status: task.status,
      priority: task.priority,
      updatedAt: task.updatedAt,
      project: task.project,
      assignees,
      assignee: assignees[0] ?? null,
    };
  });

  return {
    activeProjects,
    openTasks,
    completedTasks,
    teamMembers,
    taskStatusCounts,
    recentTasks,
  };
}
