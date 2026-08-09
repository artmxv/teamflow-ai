import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { prisma } from "../lib/prisma.js";
import { updateTask } from "./tasks.service.js";

describe("task REVIEW notifications", () => {
  const suffix = randomUUID().slice(0, 8);
  const ids = {
    actor: "",
    recipient: "",
    inaccessible: "",
    workspace: "",
    otherWorkspace: "",
    project: "",
    task: "",
    otherTask: "",
  };

  before(async () => {
    const [actor, recipient, inaccessible] = await Promise.all(
      ["actor", "recipient", "inaccessible"].map((label) =>
        prisma.user.create({
          data: {
            email: `task-review-${label}-${suffix}@example.com`,
            name: `Review ${label}`,
            passwordHash: "test-hash",
          },
        }),
      ),
    );
    ids.actor = actor.id;
    ids.recipient = recipient.id;
    ids.inaccessible = inaccessible.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: `Review workspace ${suffix}`,
        slug: `review-workspace-${suffix}`,
        members: {
          create: [
            { userId: actor.id, role: "MEMBER", status: "ACTIVE" },
            { userId: recipient.id, role: "MEMBER", status: "ACTIVE" },
            { userId: inaccessible.id, role: "MEMBER", status: "ACTIVE" },
          ],
        },
      },
    });
    const otherWorkspace = await prisma.workspace.create({
      data: {
        name: `Review other ${suffix}`,
        slug: `review-other-${suffix}`,
        members: { create: [{ userId: actor.id, role: "OWNER", status: "ACTIVE" }] },
      },
    });
    ids.workspace = workspace.id;
    ids.otherWorkspace = otherWorkspace.id;

    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: `Review project ${suffix}`,
        description: "",
        projectMembers: {
          create: [{ userId: actor.id }, { userId: recipient.id }],
        },
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        workspaceId: otherWorkspace.id,
        name: `Review other project ${suffix}`,
        description: "",
      },
    });
    ids.project = project.id;

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        key: `TR-${suffix}`,
        title: "Review notification task",
        status: "IN_PROGRESS",
        assigneeId: recipient.id,
        taskAssignees: {
          create: [{ userId: recipient.id }, { userId: inaccessible.id }],
        },
      },
    });
    const otherTask = await prisma.task.create({
      data: {
        projectId: otherProject.id,
        key: `TRO-${suffix}`,
        title: "Other workspace task",
        status: "IN_PROGRESS",
      },
    });
    ids.task = task.id;
    ids.otherTask = otherTask.id;
  });

  after(async () => {
    await prisma.workspace.deleteMany({
      where: { id: { in: [ids.workspace, ids.otherWorkspace] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ids.actor, ids.recipient, ids.inaccessible] } },
    });
  });

  it("notifies deduped accessible recipients only when entering REVIEW", async () => {
    const updated = await updateTask(
      ids.workspace,
      ids.task,
      { status: "REVIEW" },
      ids.actor,
      "MEMBER",
      ids.actor,
    );
    assert.equal(updated?.status, "REVIEW");

    const notifications = await prisma.notification.findMany({
      where: { workspaceId: ids.workspace, type: "TASK_REVIEW", entityId: ids.task },
      orderBy: { recipientId: "asc" },
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.recipientId, ids.recipient);
    assert.equal(notifications[0]?.actorId, ids.actor);
    assert.equal(notifications[0]?.href, `/app/tasks?taskId=${ids.task}`);

    await updateTask(ids.workspace, ids.task, { status: "REVIEW" }, ids.actor, "MEMBER", ids.actor);
    assert.equal(
      await prisma.notification.count({
        where: { workspaceId: ids.workspace, type: "TASK_REVIEW", entityId: ids.task },
      }),
      1,
    );
  });

  it("does not cross workspace boundaries when updating a task", async () => {
    const result = await updateTask(
      ids.workspace,
      ids.otherTask,
      { status: "REVIEW" },
      ids.actor,
      "MEMBER",
      ids.actor,
    );
    assert.equal(result, null);
    assert.equal(
      await prisma.notification.count({
        where: { type: "TASK_REVIEW", entityId: ids.otherTask },
      }),
      0,
    );
  });
});
