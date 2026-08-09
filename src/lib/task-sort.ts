import type { Priority, TaskStatus } from "@/lib/mock-data";

export type TaskSortField = "status" | "priority" | "assignee" | "dueDate";
export type SortDirection = "asc" | "desc";

export type TaskSortState = { field: TaskSortField; direction: SortDirection } | null;

export interface TaskSortableRow {
  status: TaskStatus;
  priority: Priority;
  assigneeName: string | null;
  dueDate: string | null;
}

const STATUS_ORDER: Record<TaskStatus, number> = {
  backlog: 0,
  in_progress: 1,
  review: 2,
  done: 3,
};

const PRIORITY_ORDER: Record<Priority, number> = {
  low: 0,
  medium: 1,
  urgent: 2,
};

export function cycleTaskSort(current: TaskSortState, field: TaskSortField): TaskSortState {
  if (current?.field !== field) {
    return { field, direction: "asc" };
  }
  if (current.direction === "asc") {
    return { field, direction: "desc" };
  }
  return null;
}

export function sortTasks<T extends TaskSortableRow>(tasks: T[], sort: TaskSortState): T[] {
  if (!sort) return tasks;

  const { field, direction } = sort;
  const factor = direction === "asc" ? 1 : -1;

  return [...tasks].sort((a, b) => {
    const cmp = compareByField(a, b, field, direction);
    return field === "assignee" || field === "dueDate" ? cmp : cmp * factor;
  });
}

function compareByField(
  a: TaskSortableRow,
  b: TaskSortableRow,
  field: TaskSortField,
  direction: SortDirection,
): number {
  switch (field) {
    case "status":
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case "priority":
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    case "assignee":
      return compareAssignee(a.assigneeName, b.assigneeName, direction);
    case "dueDate":
      return compareDueDate(a.dueDate, b.dueDate, direction);
  }
}

function compareAssignee(a: string | null, b: string | null, direction: SortDirection): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
  return direction === "asc" ? cmp : -cmp;
}

function compareDueDate(a: string | null, b: string | null, direction: SortDirection): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const cmp = a.localeCompare(b);
  return direction === "asc" ? cmp : -cmp;
}
