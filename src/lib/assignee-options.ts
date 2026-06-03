import type { ProjectMemberApiItem } from "@/lib/api/project-members";
import type { TaskApiItem } from "@/lib/api/tasks";

export type AssigneeOption = {
  id: string;
  name: string;
  avatar: string;
  email?: string;
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toOption(assignee: {
  id: string;
  name: string;
  email?: string;
  avatar: string | null;
}): AssigneeOption {
  return {
    id: assignee.id,
    name: assignee.name,
    email: assignee.email,
    avatar: assignee.avatar ?? initialsFromName(assignee.name),
  };
}

function taskAssigneeUsers(task: TaskApiItem) {
  if (task.assignees.length > 0) {
    return task.assignees;
  }
  return task.assignee ? [task.assignee] : [];
}

/** Workspace users that can be assigned (real API user ids from loaded tasks). */
export function buildAssigneeOptions(apiTasks: TaskApiItem[]): AssigneeOption[] {
  const byId = new Map<string, AssigneeOption>();

  for (const task of apiTasks) {
    for (const assignee of taskAssigneeUsers(task)) {
      byId.set(assignee.id, toOption(assignee));
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function buildAssigneeOptionsFromProjectMembers(
  members: ProjectMemberApiItem[],
): AssigneeOption[] {
  return members
    .map((member) => toOption(member.user))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Merge project members, workspace fallbacks, and already-selected assignees (deduped). */
export function mergeAssigneeOptions(
  ...sources: (AssigneeOption[] | undefined)[]
): AssigneeOption[] {
  const byId = new Map<string, AssigneeOption>();

  for (const source of sources) {
    if (!source) continue;
    for (const option of source) {
      byId.set(option.id, option);
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveTaskAssignees(apiTasks: TaskApiItem[], taskId: string): AssigneeOption[] {
  const task = apiTasks.find((item) => item.id === taskId);
  if (!task) {
    return [];
  }

  return taskAssigneeUsers(task).map((assignee) => toOption(assignee));
}

export function resolveTaskAssigneeIds(apiTasks: TaskApiItem[], taskId: string): string[] {
  const task = apiTasks.find((item) => item.id === taskId);
  if (!task) {
    return [];
  }

  if (task.assigneeIds.length > 0) {
    return task.assigneeIds;
  }

  return task.assigneeId ? [task.assigneeId] : [];
}

/** @deprecated Use resolveTaskAssignees instead. */
export function resolveTaskAssignee(
  assigneeId: string | null,
  apiTasks: TaskApiItem[],
  taskId?: string,
): AssigneeOption | null {
  if (taskId) {
    const assignees = resolveTaskAssignees(apiTasks, taskId);
    if (assignees.length > 0) {
      return assignees[0];
    }
  }

  if (!assigneeId) return null;

  for (const task of apiTasks) {
    for (const assignee of taskAssigneeUsers(task)) {
      if (assignee.id === assigneeId) {
        return toOption(assignee);
      }
    }
  }

  return null;
}

export function taskHasAssignee(
  task: Pick<TaskApiItem, "assigneeIds" | "assigneeId">,
  userId: string,
) {
  if (task.assigneeIds.length > 0) {
    return task.assigneeIds.includes(userId);
  }
  return task.assigneeId === userId;
}

export function taskIsUnassigned(task: Pick<TaskApiItem, "assigneeIds" | "assigneeId">) {
  if (task.assigneeIds.length > 0) {
    return false;
  }
  return !task.assigneeId;
}
