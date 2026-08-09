import type { DashboardTaskStatus } from "@/lib/api/dashboard";
import type { TaskStatus } from "@/lib/mock-data";

/**
 * Task status semantic layer (fixed roles).
 * BACKLOG slate · IN_PROGRESS blue/cyan · REVIEW amber · DONE green
 * Do not reuse these exact tokens for project identity or priority.
 */
export const taskStatusColumnDotClass: Record<TaskStatus, string> = {
  backlog: "bg-slate-400 dark:bg-slate-500",
  in_progress: "bg-info",
  review: "bg-amber-500",
  done: "bg-success",
};

/** Status chips in task lists, dashboard activity, and similar UI. */
export const taskStatusChipClass: Record<TaskStatus, string> = {
  backlog: "border border-border/60 bg-muted text-foreground/80",
  in_progress: "border border-info/25 bg-info/15 text-info",
  review: "border border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-200",
  done: "border border-success/20 bg-success/15 text-success",
};

/**
 * Solid fills for charts and legend swatches.
 * Uses design tokens (--color-*) aligned with Kanban column dots and chip hues.
 */
export const taskStatusChartFill: Record<TaskStatus, string> = {
  backlog: "var(--color-muted-foreground)",
  in_progress: "var(--color-info)",
  review: "var(--color-warning)",
  done: "var(--color-success)",
};

const dashboardToTaskStatus: Record<DashboardTaskStatus, TaskStatus> = {
  BACKLOG: "backlog",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  DONE: "done",
};

export function chartFillForDashboardStatus(status: DashboardTaskStatus): string {
  return taskStatusChartFill[dashboardToTaskStatus[status]];
}
