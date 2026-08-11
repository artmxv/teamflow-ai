export type Priority = "low" | "medium" | "urgent";
export type TaskStatus = "backlog" | "in_progress" | "review" | "done";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  openTasks: number;
  totalTasks: number;
  members: string[]; // member ids
  color: string;
  dueDate: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Task {
  id: string;
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  assigneeIds: string[];
  projectId: string;
  dueDate: string | null;
  labels: string[];
  comments: Comment[];
  /** From API when task list includes counts without full comment bodies. */
  commentsCount?: number;
  attachmentsCount?: number;
  checklist: { id: string; label: string; done: boolean }[];
  activity: { id: string; text: string; at: string }[];
  attachments: { id: string; name: string; size: string }[];
}

export const priorityMeta: Record<Priority, { label: string; className: string }> = {
  low: { label: "Low", className: "border border-border/60 bg-muted text-muted-foreground" },
  medium: {
    label: "Medium",
    className: "border border-violet-500/25 bg-violet-500/12 text-violet-700 dark:text-violet-300",
  },
  urgent: {
    label: "Urgent",
    className: "border border-red-500/30 bg-red-500/12 text-red-700 dark:text-red-300",
  },
};

export const projectStatusMeta: Record<ProjectStatus, { label: string; className: string }> = {
  planning: { label: "Planning", className: "bg-info/15 text-info" },
  active: { label: "Active", className: "bg-success/15 text-success" },
  on_hold: { label: "On hold", className: "bg-warning/20 text-warning-foreground" },
  completed: { label: "Completed", className: "bg-muted text-muted-foreground" },
};

/** Solid dots aligned with Projects filter/card status semantics. */
export const projectStatusDotClass: Record<ProjectStatus, string> = {
  planning: "bg-info",
  active: "bg-success",
  on_hold: "bg-warning",
  completed: "bg-violet-500",
};

export const statusColumns: { key: TaskStatus; title: string }[] = [
  { key: "backlog", title: "Backlog" },
  { key: "in_progress", title: "In Progress" },
  { key: "review", title: "Review" },
  { key: "done", title: "Done" },
];
