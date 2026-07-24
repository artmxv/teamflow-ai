import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { prisma } from "../lib/prisma.js";
import { buildOverviewCopy } from "./ai-copy.js";
import {
  MAX_TASK_EXAMPLES,
  STALE_IN_PROGRESS_DAYS,
  buildWorkspaceAiSummaryFromData,
  getWorkspaceAiSummary,
  isStaleInProgressTask,
  type TaskWithRelations,
} from "./ai.service.js";

const FIXED_NOW = new Date("2026-07-24T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const suffix = randomBytes(4).toString("hex");

function email(label: string) {
  return `${label}.${suffix}@ai-summary-test.teamflow.local`;
}

function makeProject(
  overrides: Partial<{
    id: string;
    name: string;
    status: "ACTIVE" | "PLANNING" | "ON_HOLD" | "COMPLETED";
  }> = {},
) {
  return {
    id: overrides.id ?? "project-1",
    name: overrides.name ?? "Alpha",
    status: overrides.status ?? ("ACTIVE" as const),
  };
}

function makeTask(
  overrides: Partial<TaskWithRelations> & Pick<TaskWithRelations, "key" | "title">,
): TaskWithRelations {
  const project = overrides.project ?? makeProject();
  return {
    id: overrides.id ?? overrides.key,
    key: overrides.key,
    title: overrides.title,
    status: overrides.status ?? "TODO",
    priority: overrides.priority ?? "MEDIUM",
    dueDate: overrides.dueDate === undefined ? null : overrides.dueDate,
    updatedAt: overrides.updatedAt ?? FIXED_NOW,
    assigneeId: overrides.assigneeId === undefined ? null : overrides.assigneeId,
    project,
    assignee: overrides.assignee === undefined ? null : overrides.assignee,
    taskAssignees: overrides.taskAssignees ?? [],
  };
}

describe("ai.service helpers", () => {
  it("marks IN_PROGRESS stale after 7 full days", () => {
    const staleUpdatedAt = new Date(FIXED_NOW.getTime() - STALE_IN_PROGRESS_DAYS * DAY_MS);
    assert.equal(
      isStaleInProgressTask({ status: "IN_PROGRESS", updatedAt: staleUpdatedAt }, FIXED_NOW),
      true,
    );
  });

  it("does not mark fresh IN_PROGRESS as stale", () => {
    const freshUpdatedAt = new Date(FIXED_NOW.getTime() - (STALE_IN_PROGRESS_DAYS - 1) * DAY_MS);
    assert.equal(
      isStaleInProgressTask({ status: "IN_PROGRESS", updatedAt: freshUpdatedAt }, FIXED_NOW),
      false,
    );
  });

  it("does not mark non IN_PROGRESS as stale", () => {
    const oldUpdatedAt = new Date(FIXED_NOW.getTime() - 30 * DAY_MS);
    assert.equal(
      isStaleInProgressTask({ status: "TODO", updatedAt: oldUpdatedAt }, FIXED_NOW),
      false,
    );
  });
});

describe("buildWorkspaceAiSummaryFromData", () => {
  it("returns empty-workspace copy for EN", () => {
    const summary = buildWorkspaceAiSummaryFromData([], [], "en", FIXED_NOW);
    assert.equal(summary.metrics.totalProjects, 0);
    assert.equal(summary.metrics.totalTasks, 0);
    assert.match(summary.overview, /no projects yet/i);
    assert.equal(summary.highlights.length, 1);
    assert.match(summary.risks[0] ?? "", /no major risks/i);
    assert.ok(summary.recommendedNextActions.length >= 3);
    assert.match(summary.standupSummary, /does not have projects yet/i);
  });

  it("returns empty-workspace copy for RU", () => {
    const summary = buildWorkspaceAiSummaryFromData([], [], "ru", FIXED_NOW);
    assert.match(summary.overview, /пока нет проектов/i);
    assert.match(summary.risks[0] ?? "", /рисков сейчас не обнаружено/i);
    assert.match(summary.standupSummary, /проектов пока нет/i);
  });

  it("includes overdue risk with task ref", () => {
    const task = makeTask({
      key: "TF-OVERDUE",
      title: "Fix billing",
      status: "TODO",
      dueDate: new Date(FIXED_NOW.getTime() - DAY_MS),
      assigneeId: "u1",
      assignee: { id: "u1", name: "Alex" },
    });
    const summary = buildWorkspaceAiSummaryFromData([makeProject()], [task], "en", FIXED_NOW);
    assert.equal(summary.metrics.overdueTasks, 1);
    assert.ok(summary.risks[0]?.includes("TF-OVERDUE"));
    assert.ok(summary.risks[0]?.includes("Fix billing"));
    assert.ok(summary.recommendedNextActions.some((action) => action.includes("TF-OVERDUE")));
  });

  it("includes urgent risk with concrete task ref", () => {
    const task = makeTask({
      key: "TF-URGENT",
      title: "Stop the leak",
      status: "IN_PROGRESS",
      priority: "URGENT",
      dueDate: new Date(FIXED_NOW.getTime() + DAY_MS),
      assigneeId: "u1",
      assignee: { id: "u1", name: "Alex" },
      updatedAt: FIXED_NOW,
    });
    const summary = buildWorkspaceAiSummaryFromData([makeProject()], [task], "en", FIXED_NOW);
    assert.equal(summary.metrics.urgentTasks, 1);
    const urgentRisk = summary.risks.find((risk) => /urgent/i.test(risk));
    assert.ok(urgentRisk);
    assert.ok(urgentRisk?.includes("TF-URGENT"));
    assert.ok(urgentRisk?.includes("Stop the leak"));
  });

  it("flags unassigned open tasks", () => {
    const task = makeTask({
      key: "TF-UNASSIGNED",
      title: "Needs owner",
      status: "TODO",
      assigneeId: null,
      assignee: null,
      taskAssignees: [],
    });
    const summary = buildWorkspaceAiSummaryFromData([makeProject()], [task], "en", FIXED_NOW);
    const risk = summary.risks.find((item) => /unassigned/i.test(item));
    assert.ok(risk);
    assert.ok(risk?.includes("TF-UNASSIGNED"));
    assert.ok(
      summary.recommendedNextActions.some(
        (action) => /assign/i.test(action) && action.includes("TF-UNASSIGNED"),
      ),
    );
  });

  it("flags HIGH/URGENT open tasks without due date", () => {
    const task = makeTask({
      key: "TF-NODUE",
      title: "Ship hotfix",
      status: "TODO",
      priority: "HIGH",
      dueDate: null,
      assigneeId: "u1",
      assignee: { id: "u1", name: "Alex" },
    });
    const summary = buildWorkspaceAiSummaryFromData([makeProject()], [task], "en", FIXED_NOW);
    const risk = summary.risks.find((item) => /without a due date/i.test(item));
    assert.ok(risk);
    assert.ok(risk?.includes("TF-NODUE"));
    assert.ok(
      summary.recommendedNextActions.some(
        (action) => /due date/i.test(action) && action.includes("TF-NODUE"),
      ),
    );
  });

  it("flags stale IN_PROGRESS at the exact 7 full days boundary", () => {
    const task = makeTask({
      key: "TF-STALE",
      title: "Long running",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueDate: new Date(FIXED_NOW.getTime() + 3 * DAY_MS),
      assigneeId: "u1",
      assignee: { id: "u1", name: "Alex" },
      updatedAt: new Date(FIXED_NOW.getTime() - STALE_IN_PROGRESS_DAYS * DAY_MS),
    });
    const summary = buildWorkspaceAiSummaryFromData([makeProject()], [task], "en", FIXED_NOW);
    const risk = summary.risks.find((item) => /no updates for 7 days or more/i.test(item));
    assert.ok(risk);
    assert.ok(risk?.includes("TF-STALE"));
  });

  it("does not flag fresh IN_PROGRESS as stale", () => {
    const task = makeTask({
      key: "TF-FRESH",
      title: "Moving",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueDate: new Date(FIXED_NOW.getTime() + 3 * DAY_MS),
      assigneeId: "u1",
      assignee: { id: "u1", name: "Alex" },
      updatedAt: new Date(FIXED_NOW.getTime() - (STALE_IN_PROGRESS_DAYS - 1) * DAY_MS),
    });
    const summary = buildWorkspaceAiSummaryFromData([makeProject()], [task], "en", FIXED_NOW);
    assert.equal(
      summary.risks.some((item) => /no updates for 7 days or more/i.test(item)),
      false,
    );
  });

  it("does not include DONE tasks in open risk signals", () => {
    const doneUrgent = makeTask({
      key: "TF-DONE-URGENT",
      title: "Already shipped",
      status: "DONE",
      priority: "URGENT",
      dueDate: new Date(FIXED_NOW.getTime() - DAY_MS),
      assigneeId: null,
      assignee: null,
      taskAssignees: [],
      updatedAt: new Date(FIXED_NOW.getTime() - 30 * DAY_MS),
    });
    const summary = buildWorkspaceAiSummaryFromData([makeProject()], [doneUrgent], "en", FIXED_NOW);
    assert.equal(summary.metrics.openTasks, 0);
    assert.equal(summary.metrics.urgentTasks, 0);
    assert.equal(summary.metrics.overdueTasks, 0);
    assert.equal(summary.metrics.completedTasks, 1);
    assert.match(summary.risks[0] ?? "", /no major risks/i);
    assert.equal(
      summary.risks.some((item) => item.includes("TF-DONE-URGENT")),
      false,
    );
  });

  it("orders risks by priority and limits task examples", () => {
    const tasks = [
      makeTask({
        key: "TF-OD-1",
        title: "Overdue one",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: new Date(FIXED_NOW.getTime() - DAY_MS),
        assigneeId: "u1",
        assignee: { id: "u1", name: "Alex" },
      }),
      makeTask({
        key: "TF-UR-1",
        title: "Urgent one",
        status: "TODO",
        priority: "URGENT",
        dueDate: new Date(FIXED_NOW.getTime() + DAY_MS),
        assigneeId: "u1",
        assignee: { id: "u1", name: "Alex" },
      }),
      makeTask({
        key: "TF-ST-1",
        title: "Stale one",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        dueDate: new Date(FIXED_NOW.getTime() + DAY_MS),
        assigneeId: "u1",
        assignee: { id: "u1", name: "Alex" },
        updatedAt: new Date(FIXED_NOW.getTime() - STALE_IN_PROGRESS_DAYS * DAY_MS),
      }),
      makeTask({
        key: "TF-UA-1",
        title: "Unassigned one",
        status: "TODO",
        priority: "LOW",
      }),
      makeTask({
        key: "TF-ND-1",
        title: "No due one",
        status: "TODO",
        priority: "HIGH",
        dueDate: null,
        assigneeId: "u1",
        assignee: { id: "u1", name: "Alex" },
      }),
      ...Array.from({ length: MAX_TASK_EXAMPLES + 2 }, (_, index) =>
        makeTask({
          key: `TF-OD-EXTRA-${index}`,
          title: `Extra overdue ${index}`,
          status: "TODO",
          dueDate: new Date(FIXED_NOW.getTime() - DAY_MS),
          assigneeId: "u1",
          assignee: { id: "u1", name: "Alex" },
        }),
      ),
    ];

    const summary = buildWorkspaceAiSummaryFromData([makeProject()], tasks, "en", FIXED_NOW);
    assert.match(summary.risks[0] ?? "", /overdue/i);
    assert.match(summary.risks[1] ?? "", /urgent/i);
    assert.match(summary.risks[2] ?? "", /no updates for 7 days or more/i);
    assert.match(summary.risks[3] ?? "", /unassigned/i);
    assert.match(summary.risks[4] ?? "", /without a due date/i);

    const overdueRisk = summary.risks[0] ?? "";
    assert.equal((overdueRisk.match(/TF-OD-/g) ?? []).length, MAX_TASK_EXAMPLES);
    assert.equal(overdueRisk.includes("TF-OD-EXTRA-3"), false);
  });

  it("uses RU locale phrasing for concrete signals", () => {
    const task = makeTask({
      key: "TF-RU",
      title: "Срочно",
      status: "TODO",
      priority: "URGENT",
      dueDate: null,
    });
    const summary = buildWorkspaceAiSummaryFromData([makeProject()], [task], "ru", FIXED_NOW);
    assert.ok(summary.risks.some((risk) => /срочн/i.test(risk) && risk.includes("TF-RU")));
    assert.ok(summary.risks.some((risk) => /без срока/i.test(risk)));
    assert.ok(summary.risks.some((risk) => /без исполнителя/i.test(risk)));
    assert.match(summary.overview, /срочн/i);
  });

  it("uses singular active project wording in EN overview", () => {
    const overview = buildOverviewCopy("en", {
      totalProjects: 1,
      activeProjects: 1,
      totalTasks: 1,
      openTasks: 0,
      completedTasks: 1,
      urgentTasks: 0,
      highPriorityTasks: 0,
      reviewTasks: 0,
      overdueTasks: 0,
    });
    assert.match(overview, /1 active project/i);
    assert.equal(overview.includes("1 active projects"), false);
  });

  it("uses singular active project wording in RU overview", () => {
    const overview = buildOverviewCopy("ru", {
      totalProjects: 1,
      activeProjects: 1,
      totalTasks: 1,
      openTasks: 0,
      completedTasks: 1,
      urgentTasks: 0,
      highPriorityTasks: 0,
      reviewTasks: 0,
      overdueTasks: 0,
    });
    assert.ok(overview.includes("1 активный проект"));
    assert.equal(overview.includes("1 активных проектов"), false);
  });
});

describe("getWorkspaceAiSummary ACL", () => {
  let workspaceAId = "";
  let workspaceBId = "";
  let ownerAId = "";
  let memberAId = "";
  let ownerBId = "";
  let openProjectId = "";
  let closedProjectId = "";
  const userIds: string[] = [];
  const workspaceIds: string[] = [];

  before(async () => {
    const ownerA = await prisma.user.create({
      data: { name: "AI Owner A", email: email("owner-a"), passwordHash: "test-hash" },
    });
    const memberA = await prisma.user.create({
      data: { name: "AI Member A", email: email("member-a"), passwordHash: "test-hash" },
    });
    const ownerB = await prisma.user.create({
      data: { name: "AI Owner B", email: email("owner-b"), passwordHash: "test-hash" },
    });
    ownerAId = ownerA.id;
    memberAId = memberA.id;
    ownerBId = ownerB.id;
    userIds.push(ownerA.id, memberA.id, ownerB.id);

    const workspaceA = await prisma.workspace.create({
      data: {
        name: `AI WS A ${suffix}`,
        slug: `ai-ws-a-${suffix}`,
        plan: "TEAM",
        members: {
          create: [
            { userId: ownerA.id, role: "OWNER", status: "ACTIVE" },
            { userId: memberA.id, role: "MEMBER", status: "ACTIVE" },
          ],
        },
      },
    });
    const workspaceB = await prisma.workspace.create({
      data: {
        name: `AI WS B ${suffix}`,
        slug: `ai-ws-b-${suffix}`,
        plan: "TEAM",
        members: {
          create: [{ userId: ownerB.id, role: "OWNER", status: "ACTIVE" }],
        },
      },
    });
    workspaceAId = workspaceA.id;
    workspaceBId = workspaceB.id;
    workspaceIds.push(workspaceA.id, workspaceB.id);

    const openProject = await prisma.project.create({
      data: {
        workspaceId: workspaceA.id,
        name: `Open Project ${suffix}`,
        description: "Visible to member",
        status: "ACTIVE",
        projectMembers: {
          create: [{ userId: memberA.id, role: "MEMBER" }],
        },
      },
    });
    const closedProject = await prisma.project.create({
      data: {
        workspaceId: workspaceA.id,
        name: `Secret Project ${suffix}`,
        description: "Hidden from member",
        status: "ACTIVE",
      },
    });
    openProjectId = openProject.id;
    closedProjectId = closedProject.id;

    await prisma.task.create({
      data: {
        key: `OPEN-${suffix}`,
        projectId: openProject.id,
        title: "Open visible task",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: memberA.id,
        taskAssignees: { create: [{ userId: memberA.id }] },
      },
    });

    await prisma.task.create({
      data: {
        key: `SECRET-${suffix}`,
        projectId: closedProject.id,
        title: "Hidden secret task",
        status: "TODO",
        priority: "URGENT",
        dueDate: new Date(FIXED_NOW.getTime() - DAY_MS),
        assigneeId: ownerA.id,
        taskAssignees: { create: [{ userId: ownerA.id }] },
      },
    });

    await prisma.project.create({
      data: {
        workspaceId: workspaceB.id,
        name: `Other Workspace Project ${suffix}`,
        description: "Should never leak",
        status: "ACTIVE",
        tasks: {
          create: [
            {
              key: `OTHER-WS-${suffix}`,
              title: "Foreign task",
              status: "TODO",
              priority: "URGENT",
              dueDate: new Date(FIXED_NOW.getTime() - DAY_MS),
            },
          ],
        },
      },
    });
  });

  after(async () => {
    for (const workspaceId of workspaceIds) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    }
  });

  it("OWNER summary includes all accessible workspace projects and tasks", async () => {
    const summary = await getWorkspaceAiSummary(workspaceAId, ownerAId, "OWNER", "en", FIXED_NOW);
    assert.equal(summary.metrics.totalProjects, 2);
    assert.equal(summary.metrics.totalTasks, 2);
    assert.equal(summary.metrics.urgentTasks, 1);
    assert.equal(summary.metrics.overdueTasks, 1);
    assert.ok(summary.highlights.some((item) => item.includes(`Secret Project ${suffix}`)));
    assert.ok(summary.risks.some((item) => item.includes(`SECRET-${suffix}`)));
    assert.ok(openProjectId);
    assert.ok(closedProjectId);
  });

  it("MEMBER does not see closed project names, keys, or counts", async () => {
    const summary = await getWorkspaceAiSummary(workspaceAId, memberAId, "MEMBER", "en", FIXED_NOW);
    assert.equal(summary.metrics.totalProjects, 1);
    assert.equal(summary.metrics.totalTasks, 1);
    assert.equal(summary.metrics.urgentTasks, 0);
    assert.equal(summary.metrics.overdueTasks, 0);
    assert.equal(summary.metrics.openTasks, 1);

    const serialized = JSON.stringify(summary);
    assert.equal(serialized.includes(`Secret Project ${suffix}`), false);
    assert.equal(serialized.includes(`SECRET-${suffix}`), false);
    assert.equal(serialized.includes("Hidden secret task"), false);
    assert.ok(serialized.includes(`Open Project ${suffix}`));
    assert.ok(serialized.includes(`OPEN-${suffix}`));
  });

  it("does not leak workspace B data into workspace A summary", async () => {
    const summaryA = await getWorkspaceAiSummary(workspaceAId, ownerAId, "OWNER", "en", FIXED_NOW);
    const summaryB = await getWorkspaceAiSummary(workspaceBId, ownerBId, "OWNER", "en", FIXED_NOW);

    const serializedA = JSON.stringify(summaryA);
    const serializedB = JSON.stringify(summaryB);

    assert.equal(serializedA.includes(`OTHER-WS-${suffix}`), false);
    assert.equal(serializedA.includes(`Other Workspace Project ${suffix}`), false);
    assert.ok(serializedB.includes(`OTHER-WS-${suffix}`));
    assert.equal(serializedB.includes(`SECRET-${suffix}`), false);
    assert.equal(serializedB.includes(`OPEN-${suffix}`), false);
    assert.equal(summaryB.metrics.totalProjects, 1);
    assert.equal(summaryB.metrics.totalTasks, 1);
  });
});
