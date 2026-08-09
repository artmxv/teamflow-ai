import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { prisma } from "../lib/prisma.js";
import { createProject } from "./projects.service.js";

/** Must match projects.service + frontend project-color.ts order. */
const PROJECT_COLOR_ROTATION = [
  "from-indigo-400 to-blue-700",
  "from-fuchsia-500 to-pink-400",
  "from-teal-400 to-sky-600",
  "from-lime-400 to-green-600",
  "from-purple-300 to-indigo-400",
  "from-rose-800 to-rose-400",
  "from-sky-700 to-indigo-300",
  "from-pink-400 to-rose-200",
] as const;

const PROJECT_COLOR_EXTENDED = [
  "from-cyan-700 to-teal-300",
  "from-yellow-700 to-lime-300",
  "from-stone-500 to-zinc-300",
  "from-red-900 to-orange-300",
  "from-blue-900 to-violet-300",
  "from-emerald-800 to-cyan-300",
  "from-fuchsia-800 to-purple-300",
  "from-orange-800 to-yellow-300",
] as const;

describe("projects.service color rotation", () => {
  const suffix = randomUUID().slice(0, 8);
  let workspaceId = "";
  let ownerId = "";

  before(async () => {
    const owner = await prisma.user.create({
      data: {
        email: `project-color-${suffix}@example.com`,
        name: "Color Owner",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
      },
    });
    ownerId = owner.id;
    const workspace = await prisma.workspace.create({
      data: {
        name: `Color Rotation ${suffix}`,
        slug: `color-rotation-${suffix}`,
        plan: "FREE",
        members: { create: [{ userId: owner.id, role: "OWNER", status: "ACTIVE" }] },
      },
    });
    workspaceId = workspace.id;
  });

  after(async () => {
    if (workspaceId) {
      await prisma.project.deleteMany({ where: { workspaceId } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    }
    if (ownerId) {
      await prisma.user.delete({ where: { id: ownerId } }).catch(() => undefined);
    }
  });

  it("assigns distinct palette colors for sequential creates", async () => {
    const created = [];
    for (let i = 0; i < 3; i++) {
      created.push(
        await createProject({
          workspaceId,
          name: `Sequential ${suffix} ${i}`,
          description: "",
        }),
      );
    }

    assert.equal(created[0]?.color, PROJECT_COLOR_ROTATION[0]);
    assert.equal(created[1]?.color, PROJECT_COLOR_ROTATION[1]);
    assert.equal(created[2]?.color, PROJECT_COLOR_ROTATION[2]);
    assert.notEqual(created[0]?.color, created[1]?.color);
    assert.notEqual(created[1]?.color, created[2]?.color);
  });

  it("fills first unused slot instead of wrapping by index", async () => {
    await prisma.project.deleteMany({ where: { workspaceId } });

    await createProject({
      workspaceId,
      name: `Gap A ${suffix}`,
      description: "",
      color: PROJECT_COLOR_ROTATION[0],
    });
    await createProject({
      workspaceId,
      name: `Gap C ${suffix}`,
      description: "",
      color: PROJECT_COLOR_ROTATION[2],
    });

    const fillsGap = await createProject({
      workspaceId,
      name: `Gap fill ${suffix}`,
      description: "",
    });
    assert.equal(fillsGap.color, PROJECT_COLOR_ROTATION[1]);
  });

  it("uses extended palette after base is exhausted and preserves explicit color", async () => {
    await prisma.project.deleteMany({ where: { workspaceId } });

    const firstPass = [];
    for (let i = 0; i < PROJECT_COLOR_ROTATION.length; i++) {
      firstPass.push(
        await createProject({
          workspaceId,
          name: `Base ${suffix} ${i}`,
          description: "",
        }),
      );
    }
    assert.deepEqual(
      firstPass.map((project) => project.color),
      [...PROJECT_COLOR_ROTATION],
    );

    const extended = await createProject({
      workspaceId,
      name: `Extended ${suffix}`,
      description: "",
    });
    assert.equal(extended.color, PROJECT_COLOR_EXTENDED[0]);
    assert.ok(
      !PROJECT_COLOR_ROTATION.includes(extended.color as (typeof PROJECT_COLOR_ROTATION)[number]),
    );

    const custom = "from-fuchsia-500 to-pink-400";
    const explicit = await createProject({
      workspaceId,
      name: `Explicit ${suffix}`,
      description: "",
      color: custom,
    });
    assert.equal(explicit.color, custom);
  });
});
