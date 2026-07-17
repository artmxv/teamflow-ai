import { effectiveDueDate } from "./due-datetime.js";

export const TASK_REMINDER_TYPES = {
  DUE_SOON: "TASK_DUE_SOON",
  OVERDUE: "TASK_OVERDUE",
} as const;

export type TaskReminderType = (typeof TASK_REMINDER_TYPES)[keyof typeof TASK_REMINDER_TYPES];

/** 24-hour due-soon window (milliseconds). */
export const TASK_REMINDER_DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

export function buildTaskReminderDedupeBody(dueDate: Date): string {
  return `dueAt:${dueDate.toISOString()}`;
}

export function buildTaskDueSoonTitle(taskTitle: string): string {
  return `Task "${taskTitle}" is due within 24 hours`;
}

export function buildTaskOverdueTitle(taskTitle: string): string {
  return `Task "${taskTitle}" is overdue`;
}

export type TaskDueClassification = "due_soon" | "overdue" | null;

/**
 * Classifies a stored task due date against UTC `now`.
 * Uses the exact deadline time; legacy date-only (UTC midnight) is treated as end of day.
 */
export function classifyTaskDueDate(dueDate: Date, now: Date): TaskDueClassification {
  const dueMs = effectiveDueDate(dueDate).getTime();
  const nowMs = now.getTime();

  if (dueMs < nowMs) {
    return "overdue";
  }

  if (dueMs > nowMs && dueMs <= nowMs + TASK_REMINDER_DUE_SOON_WINDOW_MS) {
    return "due_soon";
  }

  return null;
}
