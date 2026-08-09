import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { prisma } from "../lib/prisma.js";
import { runTaskDeadlineReminders } from "./task-reminders.service.js";

describe("task reminder delivery", () => {
  const suffix = randomUUID().slice(0, 8);
  const now = new Date("2000-01-01T12:00:00.000Z");
  const ids = {
    recipient: "",
    workspace: "",
    project: "",
    dueSoon: "",
    overdue: "",
  };

  before(async () => {
    const recipient = await prisma.user.create({
      data: {
        email: `task-reminders-${suffix}@example.com`,
        name: "Reminder recipient",
        passwordHash: "test-hash",
      },
    });
    ids.recipient = recipient.id;
    const workspace = await prisma.workspace.create({
      data: {
        name: `Reminder workspace ${suffix}`,
        slug: `reminder-workspace-${suffix}`,
        members: { create: [{ userId: recipient.id, role: "MEMBER", status: "ACTIVE" }] },
      },
    });
    ids.workspace = workspace.id;
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: `Reminder project ${suffix}`,
        description: "",
        projectMembers: { create: [{ userId: recipient.id }] },
      },
    });
    ids.project = project.id;

    const createTask = (
      label: string,
      dueDate: Date,
      options?: { done?: boolean; assigned?: boolean },
    ) =>
      prisma.task.create({
        data: {
          projectId: project.id,
          key: `REM-${label}-${suffix}`,
          title: `Reminder ${label}`,
          status: options?.done ? "DONE" : "IN_PROGRESS",
          dueDate,
          ...(options?.assigned === false
            ? {}
            : {
                assigneeId: recipient.id,
                taskAssignees: { create: [{ userId: recipient.id }] },
              }),
        },
      });

    const [dueSoon, overdue] = await Promise.all([
      createTask("due-soon", new Date(now.getTime() + 60 * 60 * 1000)),
      createTask("overdue", new Date(now.getTime() - 60 * 60 * 1000)),
      createTask("done", new Date(now.getTime() - 60 * 60 * 1000), { done: true }),
      createTask("unassigned", new Date(now.getTime() - 60 * 60 * 1000), { assigned: false }),
    ]);
    ids.dueSoon = dueSoon.id;
    ids.overdue = overdue.id;
  });

  after(async () => {
    await prisma.workspace.delete({ where: { id: ids.workspace } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: ids.recipient } }).catch(() => undefined);
  });

  it("creates due-soon and overdue once while skipping DONE and unassigned tasks", async () => {
    const first = await runTaskDeadlineReminders(now);
    assert.equal(first.dueSoonCreated, 1);
    assert.equal(first.overdueCreated, 1);

    const notifications = await prisma.notification.findMany({
      where: { workspaceId: ids.workspace, type: { in: ["TASK_DUE_SOON", "TASK_OVERDUE"] } },
    });
    assert.equal(notifications.length, 2);

    const second = await runTaskDeadlineReminders(now);
    assert.equal(second.dueSoonCreated, 0);
    assert.equal(second.overdueCreated, 0);
    assert.equal(second.skippedDuplicates, 2);
  });

  it("uses the unique dedupe key to prevent duplicates across concurrent runs", async () => {
    const task = await prisma.task.create({
      data: {
        projectId: ids.project,
        key: `REM-concurrent-${suffix}`,
        title: "Concurrent reminder",
        status: "IN_PROGRESS",
        dueDate: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        assigneeId: ids.recipient,
        taskAssignees: { create: [{ userId: ids.recipient }] },
      },
    });

    const results = await Promise.all([
      runTaskDeadlineReminders(now),
      runTaskDeadlineReminders(now),
    ]);
    assert.equal(
      results.reduce((sum, result) => sum + result.dueSoonCreated, 0),
      1,
    );
    assert.equal(
      await prisma.notification.count({
        where: { recipientId: ids.recipient, type: "TASK_DUE_SOON", entityId: task.id },
      }),
      1,
    );
  });

  it("allows a new reminder when the effective due date changes", async () => {
    await prisma.task.update({
      where: { id: ids.dueSoon },
      data: { dueDate: new Date(now.getTime() + 3 * 60 * 60 * 1000) },
    });
    await runTaskDeadlineReminders(now);

    assert.equal(
      await prisma.notification.count({
        where: { recipientId: ids.recipient, type: "TASK_DUE_SOON", entityId: ids.dueSoon },
      }),
      2,
    );
  });

  it("recognizes legacy reminder rows that do not have a dedupeKey", async () => {
    const dueDate = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const task = await prisma.task.create({
      data: {
        projectId: ids.project,
        key: `REM-legacy-${suffix}`,
        title: "Legacy reminder",
        status: "IN_PROGRESS",
        dueDate,
        assigneeId: ids.recipient,
        taskAssignees: { create: [{ userId: ids.recipient }] },
      },
    });
    await prisma.notification.create({
      data: {
        workspaceId: ids.workspace,
        recipientId: ids.recipient,
        type: "TASK_DUE_SOON",
        title: 'Task "Legacy reminder" is due within 24 hours',
        body: `dueAt:${dueDate.toISOString()}`,
        entityType: "task",
        entityId: task.id,
        href: `/app/tasks?taskId=${task.id}`,
      },
    });

    await runTaskDeadlineReminders(now);
    assert.equal(
      await prisma.notification.count({
        where: { recipientId: ids.recipient, type: "TASK_DUE_SOON", entityId: task.id },
      }),
      1,
    );
  });

  it("does not increment created statistics when notification creation fails", async () => {
    await prisma.task.create({
      data: {
        projectId: ids.project,
        key: `REM-failure-${suffix}`,
        title: "Failed reminder",
        status: "IN_PROGRESS",
        dueDate: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        assigneeId: ids.recipient,
        taskAssignees: { create: [{ userId: ids.recipient }] },
      },
    });

    const result = await runTaskDeadlineReminders(now, {
      createNotification: async () => "failed",
    });
    assert.equal(result.dueSoonCreated, 0);
    assert.equal(result.overdueCreated, 0);
  });
});
