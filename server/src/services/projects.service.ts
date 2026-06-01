import { prisma } from "../lib/prisma.js";

type CreateProjectInput = {
  workspaceId: string;
  name: string;
  description?: string;
  status?: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  color?: string;
  dueDate?: string | null;
};

export async function getProjects(workspaceId: string) {
  const projects = await prisma.project.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
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
      tasks: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  return projects.map((project) => {
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
  });
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
