import type { Project, Task, TaskPriority, TaskStatus, User } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { displayProjectName, displayTaskTitle } from "../lib/starter-content.js";
import {
  activeProjectsHighlight,
  buildOverviewCopy,
  completedHighlight,
  defaultHighlight,
  emptyStandup,
  emptyWorkspaceHighlight,
  inProgressHighlight,
  missingDueDateAction,
  missingDueDateRisk,
  noRisks,
  overdueAction,
  overdueRisk,
  parseAiLocale,
  rebalanceAction,
  reviewAction,
  reviewBoardAction,
  staleInProgressAction,
  staleInProgressRisk,
  startReadyWorkAction,
  starterActions,
  supportInProgressAction,
  unassignedAction,
  unassignedRisk,
  updateStatusesAction,
  urgentAction,
  urgentRisk,
  type AiLocale,
} from "./ai-copy.js";
import { getAccessibleProjectWhere, getAccessibleTaskWhere } from "./project-access.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

export const STALE_IN_PROGRESS_DAYS = 7;
export const MAX_TASK_EXAMPLES = 3;
export const MAX_RECOMMENDED_ACTIONS = 5;
export const MAX_RISKS = 6;

type AssigneeUser = Pick<User, "id" | "name">;

export type TaskWithRelations = Pick<
  Task,
  "id" | "key" | "title" | "status" | "priority" | "dueDate" | "updatedAt" | "assigneeId"
> & {
  project: Pick<Project, "id" | "name" | "status">;
  assignee: AssigneeUser | null;
  taskAssignees: { user: AssigneeUser }[];
};

type ProjectSummary = Pick<Project, "id" | "name" | "status">;

type WorkspaceAiMetrics = {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  urgentTasks: number;
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

const OPEN_TASK_STATUSES: TaskStatus[] = ["BACKLOG", "IN_PROGRESS", "REVIEW"];
const DAY_MS = 24 * 60 * 60 * 1000;

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

function isOpenTask(task: Pick<Task, "status">): boolean {
  return task.status !== "DONE";
}

function isOverdueTask(task: Pick<Task, "dueDate" | "status">, now: Date): boolean {
  return isOpenTask(task) && task.dueDate !== null && task.dueDate < now;
}

function isUnassignedOpenTask(task: TaskWithRelations): boolean {
  return isOpenTask(task) && !task.assigneeId && !task.assignee && task.taskAssignees.length === 0;
}

function isUrgentPriority(priority: TaskPriority): boolean {
  return priority === "URGENT";
}

function isMissingDueDatePriorityTask(task: TaskWithRelations): boolean {
  return isOpenTask(task) && isUrgentPriority(task.priority) && task.dueDate === null;
}

function getStaleInProgressThreshold(now: Date): Date {
  return new Date(now.getTime() - STALE_IN_PROGRESS_DAYS * DAY_MS);
}

export function isStaleInProgressTask(
  task: Pick<Task, "status" | "updatedAt">,
  now: Date,
): boolean {
  if (task.status !== "IN_PROGRESS") {
    return false;
  }
  return task.updatedAt.getTime() <= getStaleInProgressThreshold(now).getTime();
}

function formatTaskExample(task: TaskWithRelations, locale: AiLocale): string {
  const title = displayTaskTitle(task.title, locale);
  return `${task.key}: ${title}`;
}

function joinTaskExamples(tasks: TaskWithRelations[], locale: AiLocale): string {
  return tasks
    .slice(0, MAX_TASK_EXAMPLES)
    .map((task) => formatTaskExample(task, locale))
    .join("; ");
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

function computeMetrics(
  projects: ProjectSummary[],
  tasks: TaskWithRelations[],
  now: Date,
): WorkspaceAiMetrics {
  const openTasks = tasks.filter((task) => isOpenTask(task));
  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => project.status === "ACTIVE").length,
    totalTasks: tasks.length,
    openTasks: openTasks.length,
    completedTasks: tasks.filter((task) => task.status === "DONE").length,
    urgentTasks: openTasks.filter((task) => task.priority === "URGENT").length,
    reviewTasks: tasks.filter((task) => task.status === "REVIEW").length,
    overdueTasks: tasks.filter((task) => isOverdueTask(task, now)).length,
  };
}

function buildOverview(metrics: WorkspaceAiMetrics, locale: AiLocale): string {
  return buildOverviewCopy(locale, metrics);
}

function buildHighlights(
  metrics: WorkspaceAiMetrics,
  projects: ProjectSummary[],
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
  const openTasks = tasks.filter((task) => isOpenTask(task));

  const overdue = openTasks.filter((task) => isOverdueTask(task, now));
  if (overdue.length > 0) {
    risks.push(overdueRisk(locale, overdue.length, joinTaskExamples(overdue, locale)));
  }

  const urgentOpen = openTasks.filter((task) => task.priority === "URGENT");
  if (urgentOpen.length > 0) {
    risks.push(urgentRisk(locale, urgentOpen.length, joinTaskExamples(urgentOpen, locale)));
  }

  const staleInProgress = openTasks.filter((task) => isStaleInProgressTask(task, now));
  if (staleInProgress.length > 0) {
    risks.push(
      staleInProgressRisk(
        locale,
        staleInProgress.length,
        joinTaskExamples(staleInProgress, locale),
      ),
    );
  }

  const unassigned = openTasks.filter((task) => isUnassignedOpenTask(task));
  if (unassigned.length > 0) {
    risks.push(unassignedRisk(locale, unassigned.length, joinTaskExamples(unassigned, locale)));
  }

  const missingDueDate = openTasks.filter((task) => isMissingDueDatePriorityTask(task));
  if (missingDueDate.length > 0) {
    risks.push(
      missingDueDateRisk(locale, missingDueDate.length, joinTaskExamples(missingDueDate, locale)),
    );
  }

  if (risks.length === 0) {
    risks.push(noRisks(locale));
  }

  return risks.slice(0, MAX_RISKS);
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
  const openTasks = tasks.filter((task) => isOpenTask(task));

  const addAction = (action: string) => {
    if (!seen.has(action) && actions.length < MAX_RECOMMENDED_ACTIONS) {
      seen.add(action);
      actions.push(action);
    }
  };

  for (const task of openTasks.filter((item) => isOverdueTask(item, now)).slice(0, 2)) {
    addAction(overdueAction(locale, formatTaskRef(task, locale)));
  }

  for (const task of openTasks.filter((item) => item.priority === "URGENT").slice(0, 2)) {
    addAction(
      urgentAction(
        locale,
        task.key,
        displayTaskTitle(task.title, locale),
        displayProjectName(task.project.name, locale),
      ),
    );
  }

  const staleInProgress = openTasks.filter((task) => isStaleInProgressTask(task, now));
  if (staleInProgress.length > 0) {
    addAction(
      staleInProgressAction(
        locale,
        staleInProgress.length,
        joinTaskExamples(staleInProgress, locale),
      ),
    );
  }

  const unassigned = openTasks.filter((task) => isUnassignedOpenTask(task));
  if (unassigned.length > 0) {
    addAction(unassignedAction(locale, unassigned.length, joinTaskExamples(unassigned, locale)));
  }

  const missingDueDate = openTasks.filter((task) => isMissingDueDatePriorityTask(task));
  if (missingDueDate.length > 0) {
    addAction(
      missingDueDateAction(locale, missingDueDate.length, joinTaskExamples(missingDueDate, locale)),
    );
  }

  for (const task of openTasks.filter((item) => item.status === "REVIEW").slice(0, 1)) {
    addAction(reviewAction(locale, task.key));
  }

  for (const task of openTasks
    .filter(
      (item) =>
        item.status === "IN_PROGRESS" &&
        item.priority === "URGENT" &&
        !isStaleInProgressTask(item, now),
    )
    .slice(0, 1)) {
    addAction(
      supportInProgressAction(locale, task.key, displayProjectName(task.project.name, locale)),
    );
  }

  for (const task of openTasks
    .filter((item) => OPEN_TASK_STATUSES.includes(item.status) && item.status === "BACKLOG")
    .slice(0, 1)) {
    addAction(startReadyWorkAction(locale, task.key, displayTaskTitle(task.title, locale)));
  }

  if (metrics.openTasks > metrics.completedTasks) {
    addAction(rebalanceAction(locale));
  }

  addAction(updateStatusesAction(locale));

  while (actions.length < 3) {
    addAction(reviewBoardAction(locale));
    break;
  }

  return actions.slice(0, MAX_RECOMMENDED_ACTIONS);
}

function buildStandupSummary(
  metrics: WorkspaceAiMetrics,
  projects: ProjectSummary[],
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

/** Pure builder used by the service and unit tests. */
export function buildWorkspaceAiSummaryFromData(
  projects: ProjectSummary[],
  tasks: TaskWithRelations[],
  localeInput?: unknown,
  now: Date = new Date(),
): WorkspaceAiSummary {
  const locale = parseAiLocale(localeInput);
  const metrics = computeMetrics(projects, tasks, now);

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

export async function getWorkspaceAiSummary(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  localeInput?: unknown,
  now: Date = new Date(),
): Promise<WorkspaceAiSummary> {
  const projectWhere = getAccessibleProjectWhere(userId, workspaceId, role);
  const taskWhere = getAccessibleTaskWhere(userId, workspaceId, role);

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      select: { id: true, name: true, status: true },
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
        updatedAt: true,
        assigneeId: true,
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
          },
        },
        taskAssignees: {
          orderBy: { createdAt: "asc" },
          select: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  return buildWorkspaceAiSummaryFromData(projects, tasks, localeInput, now);
}
