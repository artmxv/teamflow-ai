import type { Project, Task, TaskStatus, User } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

type TaskWithRelations = Pick<Task, "id" | "key" | "title" | "status" | "priority" | "dueDate"> & {
  project: Pick<Project, "id" | "name" | "status">;
  assignee: Pick<User, "id" | "name" | "email"> | null;
};

type WorkspaceAiMetrics = {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  urgentTasks: number;
  highPriorityTasks: number;
  reviewTasks: number;
  overdueTasks: number;
};

export type WorkspaceAiSummary = {
  overview: string;
  highlights: string[];
  risks: string[];
  recommendedNextActions: string[];
  standupSummary: string;
  metrics: WorkspaceAiMetrics;
};

const OPEN_TASK_STATUSES: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW"];

function sanitizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSummaryText(value: string): string {
  return sanitizeText(value)
    .replace(/(\d+)(completed tasks?)/g, "$1 $2")
    .replace(/\.(?=[A-Z])/g, ". ");
}

function withCount(count: number, singular: string, plural: string): string {
  const label = count === 1 ? singular : plural;
  return [String(count), label].join(" ");
}

function formatCount(count: number, singular: string, plural: string): string {
  return withCount(count, singular, plural);
}

function stripTrailingPeriods(text: string): string {
  return sanitizeText(text).replace(/\.+$/, "");
}

function formatInProgressTask(task: TaskWithRelations): string {
  const key = sanitizeText(task.key);
  const title = sanitizeText(task.title);
  return `(${key}: ${title})`;
}

function isOverdueTask(task: Pick<Task, "dueDate" | "status">, now: Date): boolean {
  return task.status !== "DONE" && task.dueDate !== null && task.dueDate < now;
}

function formatTaskRef(task: TaskWithRelations): string {
  const assignee = task.assignee?.name ? ` (${task.assignee.name})` : "";
  return `${task.key}: ${task.title} in ${task.project.name}${assignee}`;
}

function buildOverview(metrics: WorkspaceAiMetrics): string {
  if (metrics.totalProjects === 0) {
    return "The workspace has no projects yet. Create a project and add tasks to start tracking delivery.";
  }

  const projectPart =
    metrics.activeProjects === metrics.totalProjects
      ? formatCount(metrics.totalProjects, "project", "projects")
      : `${metrics.activeProjects} active of ${metrics.totalProjects} projects`;

  if (metrics.totalTasks === 0) {
    return `The workspace has ${projectPart} but no tasks yet. Add tasks to monitor progress and priorities.`;
  }

  const { openTasks, completedTasks } = metrics;
  const openTasksLabel = openTasks === 1 ? "open task" : "open tasks";
  const completedTasksLabel = completedTasks === 1 ? "completed task" : "completed tasks";

  return `The workspace has ${projectPart}, ${openTasks} ${openTasksLabel}, and ${completedTasks} ${completedTasksLabel}.`;
}

function buildHighlights(
  metrics: WorkspaceAiMetrics,
  projects: Pick<Project, "name" | "status">[],
  tasks: TaskWithRelations[],
): string[] {
  const highlights: string[] = [];

  if (metrics.totalProjects === 0 && metrics.totalTasks === 0) {
    highlights.push("Workspace is ready for the first project and task backlog.");
    return highlights;
  }

  if (metrics.completedTasks > 0) {
    highlights.push(
      `${formatCount(metrics.completedTasks, "task has", "tasks have")} been completed across the workspace.`,
    );
  }

  const inProgressCount = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  if (inProgressCount > 0) {
    highlights.push(
      `${formatCount(inProgressCount, "task is", "tasks are")} actively in progress.`,
    );
  }

  const activeProjectNames = projects
    .filter((project) => project.status === "ACTIVE")
    .map((project) => project.name);
  if (activeProjectNames.length > 0) {
    highlights.push(
      `Active delivery focus: ${activeProjectNames.slice(0, 3).join(", ")}${activeProjectNames.length > 3 ? ", and others" : ""}.`,
    );
  }

  if (highlights.length === 0) {
    highlights.push("Work is underway; continue moving tasks through the workflow.");
  }

  return highlights;
}

function buildRisks(metrics: WorkspaceAiMetrics, tasks: TaskWithRelations[], now: Date): string[] {
  const risks: string[] = [];

  const overdue = tasks.filter((task) => isOverdueTask(task, now));
  if (overdue.length > 0) {
    const sample = overdue.slice(0, 3).map((task) => formatTaskRef(task));
    risks.push(
      `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} need attention: ${sample.join("; ")}.`,
    );
  }

  const urgentOpen = tasks.filter((task) => task.priority === "URGENT" && task.status !== "DONE");
  if (urgentOpen.length > 0) {
    risks.push(
      `${urgentOpen.length} urgent open task${urgentOpen.length === 1 ? "" : "s"} may block delivery if not addressed soon.`,
    );
  }

  const highPriorityOpen = tasks.filter(
    (task) => task.priority === "HIGH" && task.status !== "DONE",
  );
  if (highPriorityOpen.length > 0 && metrics.urgentTasks === 0) {
    risks.push(
      `${highPriorityOpen.length} high-priority open task${highPriorityOpen.length === 1 ? "" : "s"} should be scheduled in the current sprint.`,
    );
  }

  if (risks.length === 0) {
    risks.push("No major risks detected at this time.");
  }

  return risks;
}

function buildRecommendedNextActions(
  metrics: WorkspaceAiMetrics,
  tasks: TaskWithRelations[],
  now: Date,
): string[] {
  if (metrics.totalProjects === 0) {
    return [
      "Create the first project to organize work by initiative.",
      "Define initial milestones and owners for the new project.",
      "Add tasks with priorities and due dates once the project exists.",
    ];
  }

  if (metrics.totalTasks === 0) {
    return [
      "Break active projects into actionable tasks with clear owners.",
      "Set priorities and due dates on new tasks to enable progress tracking.",
      "Review project scope with the team and align on the first sprint goals.",
    ];
  }

  const actions: string[] = [];
  const seen = new Set<string>();

  const addAction = (action: string) => {
    if (!seen.has(action) && actions.length < 5) {
      seen.add(action);
      actions.push(action);
    }
  };

  for (const task of tasks.filter((item) => isOverdueTask(item, now)).slice(0, 2)) {
    addAction(`Resolve overdue work: ${formatTaskRef(task)}.`);
  }

  for (const task of tasks
    .filter((item) => item.priority === "URGENT" && item.status !== "DONE")
    .slice(0, 2)) {
    addAction(`Prioritize urgent task ${task.key} (${task.title}) in ${task.project.name}.`);
  }

  for (const task of tasks.filter((item) => item.status === "REVIEW").slice(0, 2)) {
    addAction(`Complete review for ${task.key} and move it to done or back to in progress.`);
  }

  for (const task of tasks
    .filter((item) => item.status === "IN_PROGRESS" && item.priority === "HIGH")
    .slice(0, 1)) {
    addAction(`Support in-progress delivery on ${task.key} in ${task.project.name}.`);
  }

  for (const task of tasks
    .filter((item) => OPEN_TASK_STATUSES.includes(item.status) && item.status === "TODO")
    .slice(0, 1)) {
    addAction(`Start or assign ready work: ${task.key} (${task.title}).`);
  }

  if (metrics.openTasks > metrics.completedTasks) {
    addAction("Run a short planning pass to rebalance open tasks across active projects.");
  }

  addAction("Update task statuses after today's work to keep the workspace summary accurate.");

  while (actions.length < 3) {
    addAction("Review the task board with the team and confirm owners for open work.");
    break;
  }

  return actions.slice(0, 5);
}

function buildStandupSummary(
  metrics: WorkspaceAiMetrics,
  projects: Pick<Project, "name" | "status">[],
  tasks: TaskWithRelations[],
): string {
  if (metrics.totalProjects === 0) {
    const sentences = [
      "The team workspace is set up but does not have projects yet",
      "Today's focus can be creating the first project and defining the initial backlog",
      "Once tasks exist, this summary will reflect in-progress and completed work",
    ]
      .map(stripTrailingPeriods)
      .filter(Boolean);

    return `${sentences.join(". ")}.`;
  }

  const activeNames = projects
    .filter((project) => project.status === "ACTIVE")
    .map((project) => project.name);
  const activeProjectNames = activeNames
    .slice(0, 2)
    .map((name) => sanitizeText(name))
    .join(" and ");
  const activeProjectsText =
    activeNames.length > 0
      ? `Active projects include ${activeProjectNames}`
      : "Projects are in planning or on hold; confirm which initiatives are active today";

  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS");
  const inProgressDetails = inProgress
    .slice(0, 2)
    .map((task) => formatInProgressTask(task))
    .join("; ");
  const progressText =
    inProgress.length > 0
      ? `Currently in progress: ${inProgressDetails}`
      : metrics.openTasks > 0
        ? "No tasks are marked in progress yet; consider pulling the next highest-priority item"
        : "All tracked tasks are complete for now";

  const riskText =
    metrics.overdueTasks > 0 || metrics.urgentTasks > 0
      ? `Before the end of the day, address ${formatCount(
          metrics.overdueTasks,
          "overdue task",
          "overdue tasks",
        )} and ${formatCount(metrics.urgentTasks, "urgent open item", "urgent open items")}`
      : "No urgent or overdue items are flagged right now";

  const completedText =
    metrics.completedTasks > 0
      ? [
          formatCount(metrics.completedTasks, "task is", "tasks are"),
          "already",
          "marked",
          "done",
        ].join(" ")
      : "Completed work will appear here as tasks move to done";

  const sentences = [activeProjectsText, progressText, completedText, riskText]
    .map(stripTrailingPeriods)
    .filter(Boolean);

  return `${sentences.join(". ")}.`;
}

export async function getWorkspaceAiSummary(workspaceId: string): Promise<WorkspaceAiSummary> {
  const now = new Date();
  const projectWhere = { workspaceId };
  const taskWhere = { project: { workspaceId } };
  const openTaskWhere = { ...taskWhere, status: { not: "DONE" as const } };

  const [
    totalProjects,
    activeProjects,
    totalTasks,
    openTasks,
    completedTasks,
    urgentTasks,
    highPriorityTasks,
    reviewTasks,
    overdueTasks,
    projects,
    tasks,
  ] = await Promise.all([
    prisma.project.count({ where: projectWhere }),
    prisma.project.count({ where: { ...projectWhere, status: "ACTIVE" } }),
    prisma.task.count({ where: taskWhere }),
    prisma.task.count({ where: openTaskWhere }),
    prisma.task.count({ where: { ...taskWhere, status: "DONE" } }),
    prisma.task.count({
      where: { ...openTaskWhere, priority: "URGENT" },
    }),
    prisma.task.count({
      where: { ...openTaskWhere, priority: "HIGH" },
    }),
    prisma.task.count({ where: { ...taskWhere, status: "REVIEW" } }),
    prisma.task.count({
      where: {
        ...openTaskWhere,
        dueDate: { lt: now },
      },
    }),
    prisma.project.findMany({
      where: projectWhere,
      select: { id: true, name: true, status: true, description: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  const metrics: WorkspaceAiMetrics = {
    totalProjects,
    activeProjects,
    totalTasks,
    openTasks,
    completedTasks,
    urgentTasks,
    highPriorityTasks,
    reviewTasks,
    overdueTasks,
  };

  return {
    overview: normalizeSummaryText(buildOverview(metrics)),
    highlights: buildHighlights(metrics, projects, tasks).map(normalizeSummaryText),
    risks: buildRisks(metrics, tasks, now).map(normalizeSummaryText),
    recommendedNextActions: buildRecommendedNextActions(metrics, tasks, now).map(
      normalizeSummaryText,
    ),
    standupSummary: normalizeSummaryText(buildStandupSummary(metrics, projects, tasks)),
    metrics,
  };
}
