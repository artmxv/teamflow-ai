import type { Priority } from "@/lib/mock-data";

/**
 * Priority is its own semantic layer (not status, not project identity).
 * LOW muted slate · MEDIUM violet · URGENT restrained red
 */
export const taskPriorityDotClass: Record<Priority, string> = {
  low: "bg-slate-400 dark:bg-slate-500",
  medium: "bg-violet-500",
  urgent: "bg-red-500",
};

/** Priority chips/badges in lists, drawers, and dashboards. */
export const taskPriorityChipClass: Record<Priority, string> = {
  low: "border border-border/60 bg-muted text-muted-foreground",
  medium: "border border-violet-500/25 bg-violet-500/12 text-violet-700 dark:text-violet-300",
  urgent: "border border-red-500/30 bg-red-500/12 text-red-700 dark:text-red-300",
};
