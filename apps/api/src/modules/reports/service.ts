import { prisma } from "../../lib/prisma";

async function accessibleProjectIds(userId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

export async function getReportsSummary(userId: string) {
  const projectIds = await accessibleProjectIds(userId);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [projectsByStatusRaw, tasksByStatusRaw, tasksByPriorityRaw, overdueCount, completedThisWeek, projects] =
    await Promise.all([
      prisma.project.groupBy({ by: ["status"], where: { id: { in: projectIds } }, _count: { _all: true } }),
      prisma.task.groupBy({ by: ["status"], where: { projectId: { in: projectIds } }, _count: { _all: true } }),
      prisma.task.groupBy({ by: ["priority"], where: { projectId: { in: projectIds } }, _count: { _all: true } }),
      prisma.task.count({
        where: { projectId: { in: projectIds }, dueDate: { lt: now }, status: { notIn: ["DONE", "CANCELLED"] } },
      }),
      prisma.task.count({
        where: { projectId: { in: projectIds }, status: "DONE", updatedAt: { gte: weekAgo } },
      }),
      prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          name: true,
          color: true,
          status: true,
          tasks: { select: { status: true } },
        },
      }),
    ]);

  const toCountMap = (rows: { _count: { _all: number } }[], key: string) =>
    Object.fromEntries(rows.map((r: any) => [r[key], r._count._all]));

  return {
    projectsByStatus: toCountMap(projectsByStatusRaw, "status"),
    tasksByStatus: toCountMap(tasksByStatusRaw, "status"),
    tasksByPriority: toCountMap(tasksByPriorityRaw, "priority"),
    overdueCount,
    completedThisWeek,
    projects: projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "DONE").length;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        status: p.status,
        totalTasks: total,
        completedTasks: done,
        completionPct: total === 0 ? 0 : Math.round((done / total) * 100),
      };
    }),
  };
}
