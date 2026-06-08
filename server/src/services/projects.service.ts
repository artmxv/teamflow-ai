import { prisma } from "../lib/prisma.js";
import { canAccessProject, getAccessibleProjectWhere } from "./project-access.service.js";
import type { WorkspaceRole } from "./workspace-context.service.js";

type CreateProjectInput = {
  workspaceId: string;
  name: string;
  description?: string;
  status?: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  color?: string;
  dueDate?: string | null;
};

type UpdateProjectInput = {
  name?: string;
  description?: string | null;
  status?: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  color?: string | null;
  dueDate?: string | null;
};

const projectDetailSelect = {
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  status: true,
  color: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  workspace: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  tasks: {
    select: {
      id: true,
      status: true,
    },
  },
} as const;

function mapProjectWithStats(project: {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: string;
  color: string | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  workspace: { id: string; name: string; slug: string };
  tasks: { id: string; status: string }[];
}) {
  const totalTasks = project.tasks.length;
  const doneTasks = project.tasks.filter((task) => task.status === "DONE").length;
  const openTasks = project.tasks.filter((task) => task.status !== "DONE").length;
  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  return {
    ...project,
    totalTasks,
    openTasks,
    progress,
  };
}

export async function findProjectInWorkspace(projectId: string, workspaceId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true },
  });
}

export type ProjectAccessResult =
  | { ok: true; projectId: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" };

export type ProjectAccessContextResult =
  | { ok: true; projectId: string; workspaceId: string; role: WorkspaceRole }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" };

export async function resolveProjectAccessForUser(
  projectId: string,
  userId: string,
  preferredContext?: { workspaceId: string; role: WorkspaceRole } | null,
): Promise<ProjectAccessContextResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  });

  if (!project) {
    return { ok: false, reason: "not_found" };
  }

  const tryAccess = async (workspaceId: string, role: WorkspaceRole) => {
    if (workspaceId !== project.workspaceId) {
      return false;
    }

    return canAccessProject(userId, workspaceId, role, projectId);
  };

  if (preferredContext) {
    if (await tryAccess(preferredContext.workspaceId, preferredContext.role)) {
      return {
        ok: true,
        projectId: project.id,
        workspaceId: project.workspaceId,
        role: preferredContext.role,
      };
    }
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId: project.workspaceId,
      status: "ACTIVE",
    },
    select: { role: true },
  });

  if (!membership) {
    return { ok: false, reason: "forbidden" };
  }

  if (!(await tryAccess(project.workspaceId, membership.role))) {
    return { ok: false, reason: "forbidden" };
  }

  return {
    ok: true,
    projectId: project.id,
    workspaceId: project.workspaceId,
    role: membership.role,
  };
}

export async function resolveProjectAccess(
  projectId: string,
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<ProjectAccessResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  });

  if (!project) {
    return { ok: false, reason: "not_found" };
  }

  if (project.workspaceId !== workspaceId) {
    return { ok: false, reason: "forbidden" };
  }

  const hasAccess = await canAccessProject(userId, workspaceId, role, projectId);
  if (!hasAccess) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, projectId: project.id };
}

export async function getProjects(workspaceId: string, userId: string, role: WorkspaceRole) {
  const projects = await prisma.project.findMany({
    where: getAccessibleProjectWhere(userId, workspaceId, role),
    orderBy: { updatedAt: "desc" },
    select: projectDetailSelect,
  });

  return projects.map(mapProjectWithStats);
}

export async function createProject(input: CreateProjectInput) {
  const project = await prisma.project.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description ?? "",
      status: input.status ?? "PLANNING",
      color: input.color,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      description: true,
      status: true,
      color: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return {
    ...project,
    tasks: [],
    totalTasks: 0,
    openTasks: 0,
    progress: 0,
  };
}

export async function updateProject(workspaceId: string, id: string, input: UpdateProjectInput) {
  const existing = await findProjectInWorkspace(id, workspaceId);
  if (!existing) {
    return null;
  }

  const data: {
    name?: string;
    description?: string;
    status?: UpdateProjectInput["status"];
    color?: string | null;
    dueDate?: Date | null;
  } = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.description !== undefined) {
    data.description = input.description ?? "";
  }
  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.color !== undefined) {
    data.color = input.color;
  }
  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  }

  const project = await prisma.project.update({
    where: { id },
    data,
    select: projectDetailSelect,
  });

  return mapProjectWithStats(project);
}

export async function deleteProject(
  workspaceId: string,
  id: string,
): Promise<{ id: string } | { ok: false; reason: "HAS_TASKS" } | null> {
  const existing = await findProjectInWorkspace(id, workspaceId);
  if (!existing) {
    return null;
  }

  const tasksCount = await prisma.task.count({
    where: { projectId: id, project: { workspaceId } },
  });

  if (tasksCount > 0) {
    return { ok: false, reason: "HAS_TASKS" };
  }

  await prisma.project.delete({
    where: { id },
  });

  return { id };
}
