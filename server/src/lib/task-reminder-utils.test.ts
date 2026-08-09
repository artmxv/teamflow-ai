import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTaskDueSoonTitle,
  buildTaskOverdueTitle,
  buildTaskReminderDedupeBody,
  buildTaskReminderDedupeKey,
  classifyTaskDueDate,
  TASK_REMINDER_DUE_SOON_WINDOW_MS,
} from "./task-reminder-utils.js";
import { validateTaskReminderCronSecret } from "./cron-secret.js";

describe("task-reminder-utils", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");

  it("classifies due soon within 24 hours", () => {
    const dueDate = new Date(now.getTime() + 10 * 60 * 60 * 1000);
    assert.equal(classifyTaskDueDate(dueDate, now), "due_soon");
  });

  it("classifies overdue when due date is in the past", () => {
    const dueDate = new Date(now.getTime() - 60_000);
    assert.equal(classifyTaskDueDate(dueDate, now), "overdue");
  });

  it("returns null when due date is more than 24 hours away", () => {
    const dueDate = new Date(now.getTime() + TASK_REMINDER_DUE_SOON_WINDOW_MS + 60_000);
    assert.equal(classifyTaskDueDate(dueDate, now), null);
  });

  it("returns null when due date equals now (not overdue, not due soon)", () => {
    assert.equal(classifyTaskDueDate(new Date(now), now), null);
  });

  it("builds stable dedupe body from due date", () => {
    const dueDate = new Date("2026-07-15T09:30:00.000Z");
    assert.equal(buildTaskReminderDedupeBody(dueDate), "dueAt:2026-07-15T09:30:00.000Z");
  });

  it("builds different dedupe bodies for changed due dates", () => {
    const first = buildTaskReminderDedupeBody(new Date("2026-07-15T09:30:00.000Z"));
    const second = buildTaskReminderDedupeBody(new Date("2026-07-16T09:30:00.000Z"));
    assert.notEqual(first, second);
  });

  it("builds a stable recipient/type/task/effective-due-date dedupe key", () => {
    assert.equal(
      buildTaskReminderDedupeKey({
        recipientId: "user-1",
        type: "TASK_DUE_SOON",
        taskId: "task-1",
        dueDate: new Date("2026-07-15T00:00:00.000Z"),
      }),
      "task-reminder:user-1:TASK_DUE_SOON:task-1:2026-07-15T23:59:59.999Z",
    );
  });

  it("builds English titles for i18n parsing", () => {
    assert.equal(
      buildTaskDueSoonTitle("Prepare release"),
      'Task "Prepare release" is due within 24 hours',
    );
    assert.equal(buildTaskOverdueTitle("Prepare release"), 'Task "Prepare release" is overdue');
  });

  it("treats legacy UTC-midnight deadlines as end of UTC day", () => {
    // Stored as date-only (midnight UTC). At noon UTC on that day it is due soon, not overdue.
    const legacyDue = new Date("2026-07-14T00:00:00.000Z");
    assert.equal(classifyTaskDueDate(legacyDue, now), "due_soon");

    const afterEndOfDay = new Date("2026-07-15T00:00:00.000Z");
    assert.equal(classifyTaskDueDate(legacyDue, afterEndOfDay), "overdue");
  });

  it("uses exact deadline time for timed due dates", () => {
    const dueAt = new Date("2026-07-14T18:30:00.000Z");
    assert.equal(classifyTaskDueDate(dueAt, now), "due_soon");
    assert.equal(classifyTaskDueDate(dueAt, new Date("2026-07-14T18:30:01.000Z")), "overdue");
  });
});

describe("validateTaskReminderCronSecret", () => {
  it("rejects when secret is not configured", () => {
    assert.equal(validateTaskReminderCronSecret(undefined, "Bearer token"), "missing_config");
  });

  it("rejects missing bearer token", () => {
    assert.equal(validateTaskReminderCronSecret("secret", undefined), "invalid");
  });

  it("rejects invalid bearer token", () => {
    assert.equal(validateTaskReminderCronSecret("secret", "Bearer wrong"), "invalid");
  });

  it("accepts valid bearer token", () => {
    assert.equal(validateTaskReminderCronSecret("secret", "Bearer secret"), "valid");
  });
});
