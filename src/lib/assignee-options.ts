import type { ProjectMemberApiItem } from "@/lib/api/project-members";
import type { TaskApiItem } from "@/lib/api/tasks";
import type { WorkspaceMemberItem } from "@/lib/api/workspace-members";

export type AssigneeOption = {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string | null;
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
  avatar?: string | null;
  avatarUrl?: string | null;
}): AssigneeOption {
  const initials = assignee.avatar?.trim() || initialsFromName(assignee.name);
  return {
    id: assignee.id,
    name: assignee.name,
    email: assignee.email,
    avatar: initials,
    avatarUrl: assignee.avatarUrl ?? null,
  };
}

function mergeAssigneeOption(existing: AssigneeOption, next: AssigneeOption): AssigneeOption {
  return {
    id: next.id,
    name: next.name || existing.name,
    email: next.email ?? existing.email,
    avatar: next.avatar || existing.avatar,
    avatarUrl: next.avatarUrl ?? existing.avatarUrl ?? null,
  };
}

function taskAssigneeUsers(task: TaskApiItem) {
  if ((task.assignees ?? []).length > 0) {
    return task.assignees;
  }
  return task.assignee ? [task.assignee] : [];
}

export function taskAssigneeIds(task: Pick<TaskApiItem, "assigneeIds" | "assigneeId">): string[] {
  const ids = task.assigneeIds ?? [];
  if (ids.length > 0) {
    return ids;
  }
  return task.assigneeId ? [task.assigneeId] : [];
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

type AssigneeUserLike = {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  avatarUrl?: string | null;
};

function buildAssigneeOptionsFromUsers(users: AssigneeUserLike[]): AssigneeOption[] {
  return users.map((user) => toOption(user)).sort((a, b) => a.name.localeCompare(b.name));
}

export function buildAssigneeOptionsFromProjectMembers(
  members: ProjectMemberApiItem[],
): AssigneeOption[] {
  return buildAssigneeOptionsFromUsers(members.map((member) => member.user));
}

export function buildAssigneeOptionsFromWorkspaceMembers(
  members: WorkspaceMemberItem[],
): AssigneeOption[] {
  return buildAssigneeOptionsFromUsers(members);
}

/** Options for create/edit pickers: project members when present, otherwise workspace members. */
export function resolveEditAssigneeOptions(
  projectMembers: ProjectMemberApiItem[] | undefined,
  workspaceMembers: WorkspaceMemberItem[] | undefined,
  ...extras: (AssigneeOption[] | undefined)[]
): AssigneeOption[] {
  const fromProject = buildAssigneeOptionsFromProjectMembers(projectMembers ?? []);
  if (fromProject.length > 0) {
    return mergeAssigneeOptions(fromProject, ...extras);
  }
  return mergeAssigneeOptions(
    buildAssigneeOptionsFromWorkspaceMembers(workspaceMembers ?? []),
    ...extras,
  );
}

/** Filter dropdowns: accessible members plus anyone already assigned on loaded tasks. */
export function buildFilterAssigneeOptions(
  apiTasks: TaskApiItem[],
  accessibleMembers: AssigneeOption[],
): AssigneeOption[] {
  return mergeAssigneeOptions(accessibleMembers, buildAssigneeOptions(apiTasks));
}

/** Merge project members, workspace fallbacks, and already-selected assignees (deduped). */
export function mergeAssigneeOptions(
  ...sources: (AssigneeOption[] | undefined)[]
): AssigneeOption[] {
  const byId = new Map<string, AssigneeOption>();

  for (const source of sources) {
    if (!source) continue;
    for (const option of source) {
      const existing = byId.get(option.id);
      byId.set(option.id, existing ? mergeAssigneeOption(existing, option) : option);
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Fill missing avatarUrl from task assignees, auth user, or member lists. */
export function enrichAssigneeOptionsWithAvatars(
  options: AssigneeOption[],
  ...sources: (AssigneeUserLike[] | undefined)[]
): AssigneeOption[] {
  const avatarById = new Map<string, string | null>();

  for (const source of sources) {
    if (!source) continue;
    for (const user of source) {
      if (user.avatarUrl) {
        avatarById.set(user.id, user.avatarUrl);
      }
    }
  }

  if (avatarById.size === 0) {
    return options;
  }

  return options.map((option) => ({
    ...option,
    avatarUrl: option.avatarUrl ?? avatarById.get(option.id) ?? null,
  }));
}

export function resolveTaskAssignees(apiTasks: TaskApiItem[], taskId: string): AssigneeOption[] {
  const task = apiTasks.find((item) => item.id === taskId);
  if (!task) {
    return [];
  }

  return taskAssigneeUsers(task).map((assignee) => toOption(assignee));
}

export function taskHasAssignee(
  task: Pick<TaskApiItem, "assigneeIds" | "assigneeId">,
  userId: string,
) {
  return taskMatchesAssignee(task, userId);
}

export function taskMatchesAssignee(
  task: Pick<TaskApiItem, "assigneeIds" | "assigneeId">,
  userId: string,
) {
  return taskAssigneeIds(task).includes(userId);
}

export function taskIsUnassigned(task: Pick<TaskApiItem, "assigneeIds" | "assigneeId">) {
  return taskAssigneeIds(task).length === 0;
}

function sortedAssigneeNames(names: string[]): string | null {
  if (names.length === 0) {
    return null;
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .join(", ");
}

export function taskSortAssigneeName(assignees: Pick<AssigneeOption, "name">[]): string | null {
  return sortedAssigneeNames(assignees.map((assignee) => assignee.name));
}
