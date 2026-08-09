import type { ProjectStatus, TaskPriority, TaskStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { getAccessibleProjectWhere, getAccessibleTaskWhere } from "./project-access.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

export const DEFAULT_AI_CONTEXT_MAX_PROJECTS = 40;
export const DEFAULT_AI_CONTEXT_MAX_TASKS = 160;
export const DEFAULT_AI_CONTEXT_DESCRIPTION_MAX_CHARS = 400;
export const DEFAULT_AI_CONTEXT_TOTAL_MAX_CHARS = 50_000;

const AI_CONTEXT_HARD_MAX_PROJECTS = 100;
const AI_CONTEXT_HARD_MAX_TASKS = 500;
const AI_CONTEXT_HARD_MAX_DESCRIPTION_CHARS = 1_000;
const AI_CONTEXT_HARD_MAX_TOTAL_CHARS = 100_000;
const AI_CONTEXT_TEXT_FIELD_MAX_CHARS = 300;

export type AiContextTruncationReason =
  | "project-count"
  | "task-count"
  | "description-length"
  | "text-length"
  | "total-size";

export type AiWorkspaceProjectContext = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  dueDate: string | null;
};

export type AiWorkspaceTaskContext = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  updatedAt: string;
  project: {
    id: string;
    name: string;
  };
  assignees: string[];
};

export type AiWorkspaceContext = {
  workspace: {
    id: string;
    name: string;
  };
  projects: AiWorkspaceProjectContext[];
  tasks: AiWorkspaceTaskContext[];
  metadata: {
    generatedAt: string;
    projectsIncluded: number;
    tasksIncluded: number;
    contextTruncated: boolean;
    truncationReasons: AiContextTruncationReason[];
  };
};

export type AiContextLimits = {
  maxProjects?: number;
  maxTasks?: number;
  maxDescriptionCharacters?: number;
  maxTotalCharacters?: number;
};

type ContextProjectRecord = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  dueDate: Date | null;
};

type ContextTaskRecord = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  updatedAt: Date;
  project: { id: string; name: string };
  assignee: { name: string } | null;
  taskAssignees: { user: { name: string } }[];
};

type NormalizedLimits = {
  maxProjects: number;
  maxTasks: number;
  maxDescriptionCharacters: number;
  maxTotalCharacters: number;
};

function boundedInteger(value: number | undefined, fallback: number, minimum: number, cap: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(cap, Math.max(minimum, Math.floor(value)));
}

function normalizeLimits(limits: AiContextLimits): NormalizedLimits {
  return {
    maxProjects: boundedInteger(
      limits.maxProjects,
      DEFAULT_AI_CONTEXT_MAX_PROJECTS,
      1,
      AI_CONTEXT_HARD_MAX_PROJECTS,
    ),
    maxTasks: boundedInteger(
      limits.maxTasks,
      DEFAULT_AI_CONTEXT_MAX_TASKS,
      1,
      AI_CONTEXT_HARD_MAX_TASKS,
    ),
    maxDescriptionCharacters: boundedInteger(
      limits.maxDescriptionCharacters,
      DEFAULT_AI_CONTEXT_DESCRIPTION_MAX_CHARS,
      1,
      AI_CONTEXT_HARD_MAX_DESCRIPTION_CHARS,
    ),
    maxTotalCharacters: boundedInteger(
      limits.maxTotalCharacters,
      DEFAULT_AI_CONTEXT_TOTAL_MAX_CHARS,
      1_000,
      AI_CONTEXT_HARD_MAX_TOTAL_CHARS,
    ),
  };
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxCharacters: number): { value: string; truncated: boolean } {
  const compact = compactText(value);
  if (compact.length <= maxCharacters) {
    return { value: compact, truncated: false };
  }
  return {
    value: `${compact.slice(0, Math.max(0, maxCharacters - 1))}…`,
    truncated: true,
  };
}

function serializeContextData(
  workspace: AiWorkspaceContext["workspace"],
  projects: AiWorkspaceProjectContext[],
  tasks: AiWorkspaceTaskContext[],
): string {
  return JSON.stringify({ workspace, projects, tasks });
}

function resolveAssigneeNames(task: ContextTaskRecord): string[] {
  const source =
    task.taskAssignees.length > 0
      ? task.taskAssignees.map((link) => link.user.name)
      : task.assignee
        ? [task.assignee.name]
        : [];
  return [...new Set(source.map((name) => compactText(name)).filter(Boolean))];
}

/** Converts already ACL-filtered Prisma records into a bounded provider snapshot. */
export function buildAiWorkspaceContextFromData(
  workspaceRecord: { id: string; name: string },
  projectRecords: ContextProjectRecord[],
  taskRecords: ContextTaskRecord[],
  limitsInput: AiContextLimits = {},
  generatedAt: Date = new Date(),
): AiWorkspaceContext {
  const limits = normalizeLimits(limitsInput);
  const reasons = new Set<AiContextTruncationReason>();
  const workspaceName = truncateText(workspaceRecord.name, AI_CONTEXT_TEXT_FIELD_MAX_CHARS);
  if (workspaceName.truncated) reasons.add("text-length");

  const workspace = { id: workspaceRecord.id, name: workspaceName.value };
  const projects: AiWorkspaceProjectContext[] = [];
  const tasks: AiWorkspaceTaskContext[] = [];

  if (projectRecords.length > limits.maxProjects) reasons.add("project-count");
  if (taskRecords.length > limits.maxTasks) reasons.add("task-count");

  for (const project of projectRecords.slice(0, limits.maxProjects)) {
    const name = truncateText(project.name, AI_CONTEXT_TEXT_FIELD_MAX_CHARS);
    const description = truncateText(project.description, limits.maxDescriptionCharacters);
    if (name.truncated) reasons.add("text-length");
    if (description.truncated) reasons.add("description-length");
    const candidate: AiWorkspaceProjectContext = {
      id: project.id,
      name: name.value,
      description: description.value,
      status: project.status,
      dueDate: project.dueDate?.toISOString() ?? null,
    };
    if (
      serializeContextData(workspace, [...projects, candidate], tasks).length >
      limits.maxTotalCharacters
    ) {
      reasons.add("total-size");
      break;
    }
    projects.push(candidate);
  }

  for (const task of taskRecords.slice(0, limits.maxTasks)) {
    const key = truncateText(task.key, AI_CONTEXT_TEXT_FIELD_MAX_CHARS);
    const title = truncateText(task.title, AI_CONTEXT_TEXT_FIELD_MAX_CHARS);
    const projectName = truncateText(task.project.name, AI_CONTEXT_TEXT_FIELD_MAX_CHARS);
    const description =
      task.description === null
        ? null
        : truncateText(task.description, limits.maxDescriptionCharacters);
    const assignees = resolveAssigneeNames(task).map((name) => {
      const result = truncateText(name, AI_CONTEXT_TEXT_FIELD_MAX_CHARS);
      if (result.truncated) reasons.add("text-length");
      return result.value;
    });
    if (key.truncated || title.truncated || projectName.truncated) reasons.add("text-length");
    if (description?.truncated) reasons.add("description-length");

    const candidate: AiWorkspaceTaskContext = {
      id: task.id,
      key: key.value,
      title: title.value,
      description: description?.value ?? null,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      updatedAt: task.updatedAt.toISOString(),
      project: { id: task.project.id, name: projectName.value },
      assignees,
    };
    if (
      serializeContextData(workspace, projects, [...tasks, candidate]).length >
      limits.maxTotalCharacters
    ) {
      reasons.add("total-size");
      break;
    }
    tasks.push(candidate);
  }

  const createContext = (): AiWorkspaceContext => ({
    workspace,
    projects,
    tasks,
    metadata: {
      generatedAt: generatedAt.toISOString(),
      projectsIncluded: projects.length,
      tasksIncluded: tasks.length,
      contextTruncated: reasons.size > 0,
      truncationReasons: [...reasons],
    },
  });

  let context = createContext();
  while (JSON.stringify(context).length > limits.maxTotalCharacters) {
    reasons.add("total-size");
    if (tasks.length > 0) {
      tasks.pop();
    } else if (projects.length > 0) {
      projects.pop();
    } else {
      break;
    }
    context = createContext();
  }

  return context;
}

export async function getAiWorkspaceContext(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  limitsInput: AiContextLimits = {},
  generatedAt: Date = new Date(),
): Promise<AiWorkspaceContext> {
  const limits = normalizeLimits(limitsInput);
  const projectWhere = getAccessibleProjectWhere(userId, workspaceId, role);
  const taskWhere = getAccessibleTaskWhere(userId, workspaceId, role);

  const [workspace, projects, tasks] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        dueDate: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: limits.maxProjects + 1,
    }),
    prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        key: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { name: true } },
        taskAssignees: {
          orderBy: { createdAt: "asc" },
          select: { user: { select: { name: true } } },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: limits.maxTasks + 1,
    }),
  ]);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  return buildAiWorkspaceContextFromData(workspace, projects, tasks, limits, generatedAt);
}
