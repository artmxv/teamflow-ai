import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { UserAvatar } from "@/components/app/UserAvatar";
import { cn } from "@/lib/utils";
import type { Priority, TaskStatus } from "@/lib/mock-data";
import type { AssigneeOption } from "@/lib/assignee-options";

/** Shared primary create CTA (New task / New project). */
export const CREATE_ACTION_BUTTON_CLASSNAME =
  "h-11 min-w-[10.5rem] gap-2 rounded-xl px-5 text-sm font-semibold shadow-glow max-sm:w-full sm:min-w-[11rem]";

/** Shared neutral geometry for Tasks, Kanban, and Projects filters. */
export const FILTER_SELECT_BASE_CLASSNAME =
  "filter-select h-10 w-full min-w-0 rounded-xl px-3 text-sm shadow-none focus-visible:ring-2 data-[state=open]:ring-2 [&>span]:min-w-0 [&>span]:truncate";

/** Fixed desktop widths — open dropdown overlays and must not grow the trigger. */
export const FILTER_SELECT_WIDTH_STATUS_CLASSNAME = "sm:w-[11.5rem]";
export const FILTER_SELECT_WIDTH_PRIORITY_CLASSNAME = "sm:w-[12.5rem]";
export const FILTER_SELECT_WIDTH_ASSIGNEE_CLASSNAME = "sm:w-[14.5rem]";

/** Kanban filter controls row: Priority | Assignee | Reset */
export const FILTER_BAR_BOARD_CONTROLS_CLASSNAME =
  "flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end";

/** Tasks filter controls row: Status | Priority | Assignee | Reset */
export const FILTER_BAR_TASKS_CONTROLS_CLASSNAME =
  "flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center";

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
/** Reset uses neutral outline surface — theme-aware, not semantic fill. */
export const FILTER_RESET_CLASSNAME =
  "h-10 w-full shrink-0 rounded-xl border border-border bg-card px-3.5 font-medium text-muted-foreground shadow-none hover:bg-muted hover:text-foreground sm:w-auto";

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

export function FilterTriggerLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function AssigneeFilterOption({ option }: { option: AssigneeOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <UserAvatar
        id={option.id}
        name={option.name}
        avatar={option.avatar}
        avatarUrl={option.avatarUrl}
        size="xs"
      />
      <span className="truncate">{option.name}</span>
    </span>
  );
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
        "mb-4 flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-soft sm:mb-5 sm:p-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
