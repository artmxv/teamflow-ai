import type { TaskApiItem, TaskApiPriority, TaskApiStatus } from "@/lib/api/tasks";
import { effectiveDueDate } from "@/lib/due-datetime";

export type DashboardAnalyticsPeriod = "week" | "month" | "year";

export type TaskAnalyticsRecord = Pick<
  TaskApiItem,
  "status" | "priority" | "assigneeIds" | "assigneeId" | "dueDate" | "createdAt" | "updatedAt"
>;

export interface TaskActivityBucket {
  key: string;
  label: string;
  startMs: number;
  endMs: number;
  created: number;
  done: number;
}

export interface TaskAnalyticsCounts {
  overdue: number;
  dueSoon: number;
  highPriorityOpen: number;
  unassigned: number;
}

export type TasksUrlDue = "overdue" | "soon";
export type TasksUrlPriorityFilter = "high";
export type TasksUrlAssigneeFilter = "unassigned";

export type TasksUrlAnalyticsFilters = {
  due?: TasksUrlDue;
  priority?: TasksUrlPriorityFilter;
  assignee?: TasksUrlAssigneeFilter;
};

function startOfLocalDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addLocalDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseInstant(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function parseDueDateMs(value: string) {
  const date = effectiveDueDate(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function taskMatchesUrlDueFilter(
  task: Pick<TaskAnalyticsRecord, "status" | "dueDate">,
  due: TasksUrlDue,
  now = new Date(),
): boolean {
  if (!isOpenStatus(task.status) || !task.dueDate) return false;

  const dueMs = parseDueDateMs(task.dueDate);
  if (dueMs === null) return false;

  const nowMs = now.getTime();
  const dueSoonEndMs = addLocalDays(startOfLocalDay(now), 8).getTime();

  if (due === "overdue") return dueMs < nowMs;
  return dueMs >= nowMs && dueMs < dueSoonEndMs;
}

export function taskMatchesUrlPriorityFilter(
  task: Pick<TaskAnalyticsRecord, "status" | "priority">,
  priority: TasksUrlPriorityFilter,
): boolean {
  if (priority !== "high") return true;
  return isOpenStatus(task.status) && isHighPriority(task.priority);
}

function taskHasAssignees(task: Pick<TaskAnalyticsRecord, "assigneeIds" | "assigneeId">): boolean {
  const assigneeIds = task.assigneeIds ?? [];
  if (assigneeIds.length > 0) {
    return true;
  }
  return Boolean(task.assigneeId);
}

export function taskMatchesUrlAssigneeFilter(
  task: Pick<TaskAnalyticsRecord, "status" | "assigneeIds" | "assigneeId">,
  assignee: TasksUrlAssigneeFilter,
): boolean {
  if (assignee !== "unassigned") return true;
  return isOpenStatus(task.status) && !taskHasAssignees(task);
}

export function taskMatchesUrlAnalyticsFilters(
  task: TaskAnalyticsRecord,
  filters: TasksUrlAnalyticsFilters,
  now = new Date(),
): boolean {
  if (filters.due && !taskMatchesUrlDueFilter(task, filters.due, now)) return false;
  if (filters.priority && !taskMatchesUrlPriorityFilter(task, filters.priority)) return false;
  if (filters.assignee && !taskMatchesUrlAssigneeFilter(task, filters.assignee)) return false;
  return true;
}

function isOpenStatus(status: TaskApiStatus) {
  return status !== "DONE";
}

function isHighPriority(priority: TaskApiPriority) {
  return priority === "HIGH" || priority === "URGENT";
}

export function computeTaskAnalyticsCounts(
  tasks: TaskAnalyticsRecord[],
  now = new Date(),
): TaskAnalyticsCounts {
  const nowMs = now.getTime();
  const dueSoonEndMs = addLocalDays(startOfLocalDay(now), 8).getTime();

  let overdue = 0;
  let dueSoon = 0;
  let highPriorityOpen = 0;
  let unassigned = 0;

  for (const task of tasks) {
    if (!isOpenStatus(task.status)) continue;

    if (task.dueDate) {
      const dueMs = parseDueDateMs(task.dueDate);
      if (dueMs !== null) {
        if (dueMs < nowMs) overdue += 1;
        else if (dueMs >= nowMs && dueMs < dueSoonEndMs) dueSoon += 1;
      }
    }

    if (isHighPriority(task.priority)) highPriorityOpen += 1;
    if (!taskHasAssignees(task)) unassigned += 1;
  }

  return { overdue, dueSoon, highPriorityOpen, unassigned };
}

function buildWeekBuckets(
  now: Date,
  locale: string,
): Omit<TaskActivityBucket, "created" | "done">[] {
  const today = startOfLocalDay(now);
  const buckets: Omit<TaskActivityBucket, "created" | "done">[] = [];

  for (let offset = -6; offset <= 0; offset += 1) {
    const start = addLocalDays(today, offset);
    const end = addLocalDays(start, 1);
    buckets.push({
      key: `day-${start.toISOString().slice(0, 10)}`,
      label: start.toLocaleDateString(locale, { weekday: "short" }),
      startMs: start.getTime(),
      endMs: end.getTime(),
    });
  }

  return buckets;
}

function buildMonthBuckets(
  now: Date,
  locale: string,
): Omit<TaskActivityBucket, "created" | "done">[] {
  const rangeEnd = addLocalDays(startOfLocalDay(now), 1);
  const rangeStart = addLocalDays(startOfLocalDay(now), -29);
  const bucketDays = 6;
  const bucketCount = 5;
  const buckets: Omit<TaskActivityBucket, "created" | "done">[] = [];

  for (let index = 0; index < bucketCount; index += 1) {
    const start = addLocalDays(rangeStart, index * bucketDays);
    const end =
      index === bucketCount - 1 ? rangeEnd : addLocalDays(rangeStart, (index + 1) * bucketDays);
    const endLabel = addLocalDays(end, -1);
    buckets.push({
      key: `week-${index}`,
      label: `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${endLabel.toLocaleDateString(locale, { day: "numeric", month: "short" })}`,
      startMs: start.getTime(),
      endMs: end.getTime(),
    });
  }

  return buckets;
}

function buildYearBuckets(
  now: Date,
  locale: string,
): Omit<TaskActivityBucket, "created" | "done">[] {
  const buckets: Omit<TaskActivityBucket, "created" | "done">[] = [];
  const anchor = startOfLocalDay(now);

  for (let index = 11; index >= 0; index -= 1) {
    const start = new Date(anchor.getFullYear(), anchor.getMonth() - index, 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() - index + 1, 1);
    buckets.push({
      key: `month-${start.getFullYear()}-${start.getMonth()}`,
      label: start.toLocaleDateString(locale, { month: "short" }),
      startMs: start.getTime(),
      endMs: end.getTime(),
    });
  }

  return buckets;
}

function buildPeriodBuckets(period: DashboardAnalyticsPeriod, now: Date, locale: string) {
  if (period === "week") return buildWeekBuckets(now, locale);
  if (period === "month") return buildMonthBuckets(now, locale);
  return buildYearBuckets(now, locale);
}

function countInBucket(tasks: TaskAnalyticsRecord[], startMs: number, endMs: number) {
  let created = 0;
  let done = 0;

  for (const task of tasks) {
    const createdMs = parseInstant(task.createdAt);
    if (createdMs !== null && createdMs >= startMs && createdMs < endMs) created += 1;

    if (task.status === "DONE") {
      const updatedMs = parseInstant(task.updatedAt);
      if (updatedMs !== null && updatedMs >= startMs && updatedMs < endMs) done += 1;
    }
  }

  return { created, done };
}

export function buildTaskActivitySeries(
  tasks: TaskAnalyticsRecord[],
  period: DashboardAnalyticsPeriod,
  locale: string,
  now = new Date(),
): TaskActivityBucket[] {
  const template = buildPeriodBuckets(period, now, locale);
  return template.map((bucket) => {
    const counts = countInBucket(tasks, bucket.startMs, bucket.endMs);
    return { ...bucket, ...counts };
  });
}

export function taskActivityHasData(buckets: TaskActivityBucket[]) {
  return buckets.some((bucket) => bucket.created > 0 || bucket.done > 0);
}

export function localeForAnalytics(lang: "en" | "ru") {
  return lang === "ru" ? "ru-RU" : "en-US";
}
