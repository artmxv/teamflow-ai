import type { DashboardTaskStatus } from "@/lib/api/dashboard";
import type { TaskStatus } from "@/lib/mock-data";

/** Kanban column header dots (see BoardColumn in app.board.tsx). */
export const taskStatusColumnDotClass: Record<TaskStatus, string> = {
  backlog: "bg-muted-foreground/50",
  todo: "bg-info",
  in_progress: "bg-primary",
  review: "bg-warning",
  done: "bg-success",
};

/** Status chips in task lists, dashboard activity, and similar UI. */
export const taskStatusChipClass: Record<TaskStatus, string> = {
  backlog: "border border-border/60 bg-muted text-foreground/80",
  todo: "border border-info/20 bg-info/15 text-info",
  in_progress: "border border-primary/20 bg-primary/15 text-primary",
  review: "border border-warning/25 bg-warning/20 text-warning-foreground",
  done: "border border-success/20 bg-success/15 text-success",
};

/**
 * Solid fills for charts and legend swatches.
 * Uses design tokens (--color-*) aligned with Kanban column dots and chip hues.
 */
export const taskStatusChartFill: Record<TaskStatus, string> = {
  backlog: "var(--color-muted-foreground)",
  todo: "var(--color-info)",
  in_progress: "var(--color-primary)",
  review: "var(--color-warning)",
  done: "var(--color-success)",
};

const dashboardToTaskStatus: Record<DashboardTaskStatus, TaskStatus> = {
  BACKLOG: "backlog",
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  DONE: "done",
};

export function chartFillForDashboardStatus(status: DashboardTaskStatus): string {
  return taskStatusChartFill[dashboardToTaskStatus[status]];
}
