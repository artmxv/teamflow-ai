import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Priority, TaskStatus } from "@/lib/mock-data";

/** Shared primary create CTA (New task / New project). */
export const CREATE_ACTION_BUTTON_CLASSNAME =
  "h-11 min-w-[10.5rem] gap-2 rounded-xl px-5 text-sm font-semibold shadow-glow max-sm:w-full sm:min-w-[11rem]";

/**
 * Shared geometry for Tasks/Kanban filled filter selects.
 * Background/color come from category CSS classes (not brand / not gray select chrome).
 * Fixed widths + truncate keep open/close from shifting neighbors.
 */
export const FILTER_SELECT_BASE_CLASSNAME =
  "filter-select h-10 w-full min-w-0 rounded-lg shadow-none focus-visible:ring-2 data-[state=open]:ring-2 [&>span]:truncate";

/** Fixed desktop widths — open dropdown overlays and must not grow the trigger. */
export const FILTER_SELECT_WIDTH_STATUS_CLASSNAME = "sm:w-[9.5rem]";
export const FILTER_SELECT_WIDTH_PRIORITY_CLASSNAME = "sm:w-[9.5rem]";
export const FILTER_SELECT_WIDTH_ASSIGNEE_CLASSNAME = "sm:w-[12.5rem]";

/** Kanban filter controls row: Priority | Assignee | Reset */
export const FILTER_BAR_BOARD_CONTROLS_CLASSNAME =
  "grid w-full gap-2 sm:ml-auto sm:w-auto sm:grid-cols-[9.5rem_12.5rem_auto]";

/** Tasks filter controls row: Status | Priority | Assignee | Reset */
export const FILTER_BAR_TASKS_CONTROLS_CLASSNAME =
  "grid grid-cols-1 gap-2 sm:grid-cols-[9.5rem_9.5rem_12.5rem_auto]";

/** Status "All / Open" master: cool blue family (never brand). */
export const FILTER_SELECT_STATUS_ALL_CLASSNAME = "filter-select-status-all";

/** Priority "All" master: soft violet family (never brand). */
export const FILTER_SELECT_PRIORITY_ALL_CLASSNAME = "filter-select-priority-all";

export const FILTER_SELECT_STATUS_CLASSNAME: Record<TaskStatus, string> = {
  backlog: "filter-select-status-backlog",
  in_progress: "filter-select-status-in-progress",
  review: "filter-select-status-review",
  done: "filter-select-status-done",
};

export const FILTER_SELECT_PRIORITY_CLASSNAME: Record<Priority, string> = {
  low: "filter-select-priority-low",
  medium: "filter-select-priority-medium",
  urgent: "filter-select-priority-urgent",
};

/** Assignee filter: fixed teal family (not brand, not status/priority). */
export const FILTER_SELECT_ASSIGNEE_CLASSNAME = "filter-select-assignee";

/**
 * @deprecated Brand master retired. Prefer FILTER_SELECT_STATUS_ALL_CLASSNAME.
 */
export const FILTER_SELECT_MASTER_CLASSNAME = FILTER_SELECT_STATUS_ALL_CLASSNAME;

/**
 * @deprecated Prefer dynamic FILTER_SELECT_* helpers. Kept for any stray imports.
 */
export const FILTER_STATUS_CLASSNAME = FILTER_SELECT_STATUS_ALL_CLASSNAME;
/** @deprecated Prefer FILTER_SELECT_PRIORITY_ALL_CLASSNAME */
export const FILTER_PRIORITY_CLASSNAME = FILTER_SELECT_PRIORITY_ALL_CLASSNAME;
/** @deprecated Prefer FILTER_SELECT_ASSIGNEE_CLASSNAME */
export const FILTER_ASSIGNEE_CLASSNAME = FILTER_SELECT_ASSIGNEE_CLASSNAME;
/** Reset uses Button variant="brandSoft" — theme secondary, not outline/destructive. */
export const FILTER_RESET_CLASSNAME =
  "h-10 w-full shrink-0 rounded-lg px-3.5 font-medium shadow-sm sm:w-auto";

export function statusFilterSelectClassName(status: TaskStatus | "all" | "open"): string {
  if (status === "all" || status === "open") {
    return cn(
      FILTER_SELECT_BASE_CLASSNAME,
      FILTER_SELECT_WIDTH_STATUS_CLASSNAME,
      FILTER_SELECT_STATUS_ALL_CLASSNAME,
    );
  }
  return cn(
    FILTER_SELECT_BASE_CLASSNAME,
    FILTER_SELECT_WIDTH_STATUS_CLASSNAME,
    FILTER_SELECT_STATUS_CLASSNAME[status],
  );
}

export function priorityFilterSelectClassName(priority: Priority | "all"): string {
  if (priority === "all") {
    return cn(
      FILTER_SELECT_BASE_CLASSNAME,
      FILTER_SELECT_WIDTH_PRIORITY_CLASSNAME,
      FILTER_SELECT_PRIORITY_ALL_CLASSNAME,
    );
  }
  return cn(
    FILTER_SELECT_BASE_CLASSNAME,
    FILTER_SELECT_WIDTH_PRIORITY_CLASSNAME,
    FILTER_SELECT_PRIORITY_CLASSNAME[priority],
  );
}

export function assigneeFilterSelectClassName(): string {
  return cn(
    FILTER_SELECT_BASE_CLASSNAME,
    FILTER_SELECT_WIDTH_ASSIGNEE_CLASSNAME,
    FILTER_SELECT_ASSIGNEE_CLASSNAME,
  );
}

/** Marks a filter select as having a non-default value (bright solid fill). */
export function filterSelectActiveAttr(isActive: boolean): "true" | "false" {
  return isActive ? "true" : "false";
}

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

/** Unified search/filter panel surface for /app list pages. */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-2xl border border-border/80 bg-gradient-to-br from-card to-card/75 p-3 shadow-card sm:mb-5 sm:p-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
