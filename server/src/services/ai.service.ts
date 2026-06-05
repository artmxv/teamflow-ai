import type { Project, Task, TaskStatus, User } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { displayProjectName, displayTaskTitle } from "../lib/starter-content.js";
import {
  activeProjectsHighlight,
  buildOverviewCopy,
  completedHighlight,
  defaultHighlight,
  emptyStandup,
  emptyWorkspaceHighlight,
  highPriorityRisk,
  inProgressHighlight,
  noRisks,
  overdueRisk,
  parseAiLocale,
  rebalanceAction,
  reviewBoardAction,
  starterActions,
  updateStatusesAction,
  urgentRisk,
  type AiLocale,
} from "./ai-copy.js";

type AssigneeUser = Pick<User, "id" | "name" | "email">;

type TaskWithRelations = Pick<Task, "id" | "key" | "title" | "status" | "priority" | "dueDate"> & {
  project: Pick<Project, "id" | "name" | "status">;
  assignee: AssigneeUser | null;
  taskAssignees: { user: AssigneeUser }[];
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

function formatInProgressTask(task: TaskWithRelations, locale: AiLocale): string {
  const key = sanitizeText(task.key);
  const title = sanitizeText(displayTaskTitle(task.title, locale));
  return `(${key}: ${title})`;
}

function isOverdueTask(task: Pick<Task, "dueDate" | "status">, now: Date): boolean {
  return task.status !== "DONE" && task.dueDate !== null && task.dueDate < now;
}

function resolveTaskAssigneeNames(task: TaskWithRelations): string[] {
  const fromJoin = task.taskAssignees.map((link) => sanitizeText(link.user.name)).filter(Boolean);
  if (fromJoin.length > 0) {
    return fromJoin;
  }
  if (task.assignee?.name) {
    return [sanitizeText(task.assignee.name)];
  }
  return [];
}

function formatAssigneeSuffix(names: string[], locale: AiLocale): string {
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return ` (${names[0]})`;
  }
  if (names.length === 2) {
    return ` (${names[0]}, ${names[1]})`;
  }
  return locale === "ru"
    ? ` (${names[0]} + ещё ${names.length - 1})`
    : ` (${names[0]} + ${names.length - 1} more)`;
}

function formatTaskRef(task: TaskWithRelations, locale: AiLocale): string {
  const assigneeSuffix = formatAssigneeSuffix(resolveTaskAssigneeNames(task), locale);
  const inWord = locale === "ru" ? "в" : "in";
  const title = displayTaskTitle(task.title, locale);
  const projectName = displayProjectName(task.project.name, locale);
  return `${task.key}: ${title} ${inWord} ${projectName}${assigneeSuffix}`;
}

function buildOverview(metrics: WorkspaceAiMetrics, locale: AiLocale): string {
  return buildOverviewCopy(locale, metrics);
}

function buildHighlights(
  metrics: WorkspaceAiMetrics,
  projects: Pick<Project, "name" | "status">[],
  tasks: TaskWithRelations[],
  locale: AiLocale,
): string[] {
  const highlights: string[] = [];

  if (metrics.totalProjects === 0 && metrics.totalTasks === 0) {
    highlights.push(emptyWorkspaceHighlight(locale));
    return highlights;
  }

  if (metrics.completedTasks > 0) {
    highlights.push(completedHighlight(locale, metrics.completedTasks));
  }

  const inProgressCount = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  if (inProgressCount > 0) {
    highlights.push(inProgressHighlight(locale, inProgressCount));
  }

  const activeProjectNames = projects
    .filter((project) => project.status === "ACTIVE")
    .map((project) => displayProjectName(project.name, locale));
  if (activeProjectNames.length > 0) {
    highlights.push(activeProjectsHighlight(locale, activeProjectNames));
  }

  if (highlights.length === 0) {
    highlights.push(defaultHighlight(locale));
  }

  return highlights;
}

function buildRisks(
  metrics: WorkspaceAiMetrics,
  tasks: TaskWithRelations[],
  now: Date,
  locale: AiLocale,
): string[] {
  const risks: string[] = [];

  const overdue = tasks.filter((task) => isOverdueTask(task, now));
  if (overdue.length > 0) {
    const sample = overdue.slice(0, 3).map((task) => formatTaskRef(task, locale));
    risks.push(overdueRisk(locale, overdue.length, sample.join("; ")));
  }

  const urgentOpen = tasks.filter((task) => task.priority === "URGENT" && task.status !== "DONE");
  if (urgentOpen.length > 0) {
    risks.push(urgentRisk(locale, urgentOpen.length));
  }

  const highPriorityOpen = tasks.filter(
    (task) => task.priority === "HIGH" && task.status !== "DONE",
  );
  if (highPriorityOpen.length > 0 && metrics.urgentTasks === 0) {
    risks.push(highPriorityRisk(locale, highPriorityOpen.length));
  }

  if (risks.length === 0) {
    risks.push(noRisks(locale));
  }

  return risks;
}

function buildRecommendedNextActions(
  metrics: WorkspaceAiMetrics,
  tasks: TaskWithRelations[],
  now: Date,
  locale: AiLocale,
): string[] {
  if (metrics.totalProjects === 0) {
    return starterActions(locale, "projects");
  }

  if (metrics.totalTasks === 0) {
    return starterActions(locale, "tasks");
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
    addAction(
      locale === "ru"
        ? `Закройте просроченную работу: ${formatTaskRef(task, locale)}.`
        : `Resolve overdue work: ${formatTaskRef(task, locale)}.`,
    );
  }

  for (const task of tasks
    .filter((item) => item.priority === "URGENT" && item.status !== "DONE")
    .slice(0, 2)) {
    addAction(
      locale === "ru"
        ? `Приоритизируйте срочную задачу ${task.key} (${displayTaskTitle(task.title, locale)}) в ${displayProjectName(task.project.name, locale)}.`
        : `Prioritize urgent task ${task.key} (${displayTaskTitle(task.title, locale)}) in ${displayProjectName(task.project.name, locale)}.`,
    );
  }

  for (const task of tasks.filter((item) => item.status === "REVIEW").slice(0, 2)) {
    addAction(
      locale === "ru"
        ? `Завершите ревью ${task.key} и переведите в done или обратно в in progress.`
        : `Complete review for ${task.key} and move it to done or back to in progress.`,
    );
  }

  for (const task of tasks
    .filter((item) => item.status === "IN_PROGRESS" && item.priority === "HIGH")
    .slice(0, 1)) {
    addAction(
      locale === "ru"
        ? `Поддержите задачу в работе ${task.key} в ${displayProjectName(task.project.name, locale)}.`
        : `Support in-progress delivery on ${task.key} in ${displayProjectName(task.project.name, locale)}.`,
    );
  }

  for (const task of tasks
    .filter((item) => OPEN_TASK_STATUSES.includes(item.status) && item.status === "TODO")
    .slice(0, 1)) {
    addAction(
      locale === "ru"
        ? `Начните или назначьте готовую работу: ${task.key} (${displayTaskTitle(task.title, locale)}).`
        : `Start or assign ready work: ${task.key} (${displayTaskTitle(task.title, locale)}).`,
    );
  }

  if (metrics.openTasks > metrics.completedTasks) {
    addAction(rebalanceAction(locale));
  }

  addAction(updateStatusesAction(locale));

  while (actions.length < 3) {
    addAction(reviewBoardAction(locale));
    break;
  }

  return actions.slice(0, 5);
}

function buildStandupSummary(
  metrics: WorkspaceAiMetrics,
  projects: Pick<Project, "name" | "status">[],
  tasks: TaskWithRelations[],
  locale: AiLocale,
): string {
  if (metrics.totalProjects === 0) {
    return emptyStandup(locale);
  }

  const activeNames = projects
    .filter((project) => project.status === "ACTIVE")
    .map((project) => displayProjectName(project.name, locale));
  const activeProjectNames = activeNames
    .slice(0, 2)
    .map((name) => sanitizeText(name))
    .join(locale === "ru" ? " и " : " and ");
  const activeProjectsText =
    activeNames.length > 0
      ? locale === "ru"
        ? `Активные проекты: ${activeProjectNames}`
        : `Active projects include ${activeProjectNames}`
      : locale === "ru"
        ? "Проекты в планировании или на паузе; уточните активные инициативы на сегодня"
        : "Projects are in planning or on hold; confirm which initiatives are active today";

  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS");
  const inProgressDetails = inProgress
    .slice(0, 2)
    .map((task) => formatInProgressTask(task, locale))
    .join("; ");
  const progressText =
    inProgress.length > 0
      ? locale === "ru"
        ? `Сейчас в работе: ${inProgressDetails}`
        : `Currently in progress: ${inProgressDetails}`
      : metrics.openTasks > 0
        ? locale === "ru"
          ? "Пока нет задач в работе; возьмите следующую по приоритету"
          : "No tasks are marked in progress yet; consider pulling the next highest-priority item"
        : locale === "ru"
          ? "Все отслеживаемые задачи выполнены"
          : "All tracked tasks are complete for now";

  const riskText =
    metrics.overdueTasks > 0 || metrics.urgentTasks > 0
      ? locale === "ru"
        ? `До конца дня закройте ${formatCount(
            metrics.overdueTasks,
            "просроченную задачу",
            "просроченных задач",
          )} и ${formatCount(metrics.urgentTasks, "срочный открытый пункт", "срочных открытых пунктов")}`
        : `Before the end of the day, address ${formatCount(
            metrics.overdueTasks,
            "overdue task",
            "overdue tasks",
          )} and ${formatCount(metrics.urgentTasks, "urgent open item", "urgent open items")}`
      : locale === "ru"
        ? "Срочных и просроченных пунктов сейчас нет"
        : "No urgent or overdue items are flagged right now";

  const completedText =
    metrics.completedTasks > 0
      ? locale === "ru"
        ? `${formatCount(metrics.completedTasks, "задача уже", "задач уже")} отмечена выполненной`
        : [
            formatCount(metrics.completedTasks, "task is", "tasks are"),
            "already",
            "marked",
            "done",
          ].join(" ")
      : locale === "ru"
        ? "Выполненная работа появится здесь по мере закрытия задач"
        : "Completed work will appear here as tasks move to done";

  const sentences = [activeProjectsText, progressText, completedText, riskText]
    .map(stripTrailingPeriods)
    .filter(Boolean);

  return `${sentences.join(". ")}.`;
}

export async function getWorkspaceAiSummary(
  workspaceId: string,
  localeInput?: unknown,
): Promise<WorkspaceAiSummary> {
  const locale = parseAiLocale(localeInput);
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
        taskAssignees: {
          orderBy: { createdAt: "asc" },
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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
    overview: normalizeSummaryText(buildOverview(metrics, locale)),
    highlights: buildHighlights(metrics, projects, tasks, locale).map(normalizeSummaryText),
    risks: buildRisks(metrics, tasks, now, locale).map(normalizeSummaryText),
    recommendedNextActions: buildRecommendedNextActions(metrics, tasks, now, locale).map(
      normalizeSummaryText,
    ),
    standupSummary: normalizeSummaryText(buildStandupSummary(metrics, projects, tasks, locale)),
    metrics,
  };
}
