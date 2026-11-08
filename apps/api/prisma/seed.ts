// Exactly one development user and one example project with a couple of
// tasks/checklist items/reminders — no fake "production-looking" data, per
// docs/DATABASE_DESIGN.md.
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "dev@projectflow.local";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed user already exists, skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash("DevPassword123!", 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Dev User",
      timezone: "Asia/Amman",
    },
  });

  const now = new Date();
  const startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const targetEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const project = await prisma.project.create({
    data: {
      ownerId: user.id,
      name: "Website Redesign",
      description: "Refresh the marketing site: new layout, copy, and a faster build pipeline.",
      startDate,
      targetEndDate,
      status: "IN_PROGRESS",
      priority: "HIGH",
      color: "#4F46E5",
      notes: "Example seed project.",
    },
  });

  const taskDueSoon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const taskDueLater = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  const task1 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Design new homepage",
      description: "Hero section, feature grid, testimonials.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: taskDueSoon,
      orderIndex: 0,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Set up CI/CD pipeline",
      description: "Automated build + deploy on push to main.",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: taskDueLater,
      orderIndex: 1,
    },
  });

  const item1 = await prisma.checklistItem.create({
    data: {
      taskId: task1.id,
      title: "Get stakeholder sign-off on wireframes",
      status: "PENDING",
      priority: "HIGH",
      dueDate: taskDueSoon,
      orderIndex: 0,
    },
  });

  await prisma.checklistItem.create({
    data: {
      taskId: task1.id,
      title: "Export final assets from Figma",
      status: "PENDING",
      priority: "MEDIUM",
      orderIndex: 1,
    },
  });

  // A one-time reminder 60 minutes before the checklist item's due date.
  const reminder1 = await prisma.reminder.create({
    data: {
      userId: user.id,
      entityType: "CHECKLIST_ITEM",
      entityId: item1.id,
      type: "ONE_TIME",
      offsetBeforeDueMinutes: 60,
      channels: ["IN_APP", "EMAIL"],
    },
  });
  await prisma.reminderOccurrence.create({
    data: {
      reminderId: reminder1.id,
      nextFireAt: new Date(taskDueSoon.getTime() - 60 * 60 * 1000),
      status: "PENDING",
    },
  });

  // A daily reminder about the project's second task.
  const reminder2 = await prisma.reminder.create({
    data: {
      userId: user.id,
      entityType: "TASK",
      entityId: task2.id,
      type: "DAILY",
      scheduledAt: new Date(now.getTime() + 60 * 60 * 1000),
      channels: ["IN_APP"],
    },
  });
  await prisma.reminderOccurrence.create({
    data: {
      reminderId: reminder2.id,
      nextFireAt: new Date(now.getTime() + 60 * 60 * 1000),
      status: "PENDING",
    },
  });

  console.log(`Seeded user ${email} (password: DevPassword123!) with project "${project.name}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
