import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "alex@teamflow.ai" },
    update: {},
    create: {
      name: "Alex Morgan",
      email: "alex@teamflow.ai",
      passwordHash: "demo-password-hash",
      avatar: "AM",
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "acme-studio" },
    update: {},
    create: {
      name: "Acme Studio",
      slug: "acme-studio",
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: "Orion Web App",
      description: "Customer-facing dashboard rebuild with a new design system.",
      status: "ACTIVE",
      color: "from-indigo-500 to-violet-500",
    },
  });

  await prisma.task.createMany({
    data: [
      {
        key: "TF-101",
        projectId: project.id,
        title: "Prepare launch checklist",
        description: "Create the first version of the launch checklist.",
        status: "TODO",
        priority: "HIGH",
        assigneeId: user.id,
      },
      {
        key: "TF-102",
        projectId: project.id,
        title: "Review billing copy",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        assigneeId: user.id,
      },
      {
        key: "TF-103",
        projectId: project.id,
        title: "Publish weekly summary",
        status: "DONE",
        priority: "LOW",
        assigneeId: user.id,
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
