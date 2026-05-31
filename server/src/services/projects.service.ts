import { prisma } from "../lib/prisma.js";

export async function getProjects() {
  const projects = await prisma.project.findMany({
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
