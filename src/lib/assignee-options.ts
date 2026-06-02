import type { TaskApiItem } from "@/lib/api/tasks";

export type AssigneeOption = {
  id: string;
  name: string;
  avatar: string;
};

export const UNASSIGNED_ASSIGNEE_VALUE = "__unassigned__";

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toOption(assignee: NonNullable<TaskApiItem["assignee"]>): AssigneeOption {
  return {
    id: assignee.id,
    name: assignee.name,
    avatar: assignee.avatar ?? initialsFromName(assignee.name),
  };
}

/** Workspace users that can be assigned (real API user ids from loaded tasks). */
export function buildAssigneeOptions(apiTasks: TaskApiItem[]): AssigneeOption[] {
  const byId = new Map<string, AssigneeOption>();

  for (const task of apiTasks) {
    if (task.assignee) {
      byId.set(task.assignee.id, toOption(task.assignee));
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveTaskAssignee(
  assigneeId: string | null,
  apiTasks: TaskApiItem[],
  taskId?: string,
): AssigneeOption | null {
  if (!assigneeId) return null;

  if (taskId) {
    const ownTask = apiTasks.find((task) => task.id === taskId);
    if (ownTask?.assignee?.id === assigneeId) {
      return toOption(ownTask.assignee);
    }
  }

  for (const task of apiTasks) {
    if (task.assignee?.id === assigneeId) {
      return toOption(task.assignee);
    }
  }

  return null;
}
