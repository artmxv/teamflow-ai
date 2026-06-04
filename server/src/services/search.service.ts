import { prisma } from "../lib/prisma.js";
import { getAccessibleProjectWhere, getAccessibleTaskWhere } from "./project-access.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

const MAX_PER_GROUP = 5;

export type GlobalSearchResultType = "project" | "task" | "member";

export interface GlobalSearchProjectResult {
  id: string;
  type: "project";
  title: string;
  subtitle: string | null;
  href: string;
}

export interface GlobalSearchTaskResult {
  id: string;
  type: "task";
  title: string;
  subtitle: string | null;
  href: string;
  projectName: string;
}

export interface GlobalSearchMemberResult {
  id: string;
  type: "member";
  title: string;
  subtitle: string | null;
  href: string;
  avatar: string | null;
}

export interface GlobalSearchGroupedResults {
  projects: GlobalSearchProjectResult[];
  tasks: GlobalSearchTaskResult[];
  members: GlobalSearchMemberResult[];
}

export type SearchWorkspaceInput = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  query: string;
  limit?: number;
};

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function textContainsFilter(query: string) {
  return { contains: query, mode: "insensitive" as const };
}

export async function searchWorkspace(
  input: SearchWorkspaceInput,
): Promise<GlobalSearchGroupedResults> {
  const trimmed = input.query.trim();
  if (trimmed.length < 2) {
    return { projects: [], tasks: [], members: [] };
  }

  const perGroup = Math.min(input.limit ?? MAX_PER_GROUP, MAX_PER_GROUP);
  const { workspaceId, userId, role } = input;

  const [projects, tasks, memberRows] = await Promise.all([
    prisma.project.findMany({
      where: {
        AND: [
          getAccessibleProjectWhere(userId, workspaceId, role),
          {
            OR: [
              { name: textContainsFilter(trimmed) },
              { description: textContainsFilter(trimmed) },
            ],
          },
        ],
      },
      orderBy: { name: "asc" },
      take: perGroup,
      select: {
        id: true,
        name: true,
        description: true,
      },
    }),
    prisma.task.findMany({
      where: {
        AND: [
          getAccessibleTaskWhere(userId, workspaceId, role),
          {
            OR: [
              { title: textContainsFilter(trimmed) },
              { key: textContainsFilter(trimmed) },
              { description: textContainsFilter(trimmed) },
            ],
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: perGroup,
      select: {
        id: true,
        title: true,
        key: true,
        description: true,
        project: {
          select: { name: true },
        },
      },
    }),
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        status: "ACTIVE",
        user: {
          OR: [{ name: textContainsFilter(trimmed) }, { email: textContainsFilter(trimmed) }],
        },
      },
      orderBy: { user: { name: "asc" } },
      take: perGroup,
      select: {
        user: {
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

  return {
    projects: projects.map((project) => ({
      id: project.id,
      type: "project" as const,
      title: project.name,
      subtitle: project.description ? truncateText(project.description, 120) : null,
      href: `/app/projects/${project.id}`,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      title: task.title,
      subtitle: task.key,
      href: `/app/tasks?taskId=${task.id}`,
      projectName: task.project.name,
    })),
    members: memberRows.map((row) => ({
      id: row.user.id,
      type: "member" as const,
      title: row.user.name,
      subtitle: row.user.email,
      href: `/app/team?memberId=${row.user.id}`,
      avatar: row.user.avatar,
    })),
  };
}
