// Dashboard + My Day: purpose-built aggregate queries, never N calls to per-project
// endpoints (NFR1). Every query here is scoped to projects the user owns or is a
// member of.
import { DateTime } from "luxon";
import { prisma } from "../../lib/prisma";
import { toWireProject, computeTaskAggregates } from "../projects/service";
import { resolveEntityContext } from "../../lib/access";

const UPCOMING_WINDOW_DAYS = 7;

async function accessibleProjectIds(userId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

export async function getDashboardSummary(userId: string) {
  const projectIds = await accessibleProjectIds(userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const now = new Date();
  const zoned = DateTime.fromJSDate(now, { zone: "utc" }).setZone(user.timezone);
  const todayStart = zoned.startOf("day").toUTC().toJSDate();
  const todayEnd = zoned.endOf("day").toUTC().toJSDate();
  const upcomingEnd = DateTime.fromJSDate(now).plus({ days: UPCOMING_WINDOW_DAYS }).toJSDate();

  const [
    totalProjects,
    activeProjects,
    completedProjects,
    tasksDueToday,
    overdueTasks,
    upcomingReminders,
    pendingChecklists,
    recentlyUpdatedProjectRows,
    recentActivity,
  ] = await Promise.all([
    prisma.project.count({ where: { id: { in: projectIds } } }),
    prisma.project.count({ where: { id: { in: projectIds }, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    prisma.project.count({ where: { id: { in: projectIds }, status: "COMPLETED" } }),
    prisma.task.count({
      where: { projectId: { in: projectIds }, dueDate: { gte: todayStart, lte: todayEnd }, status: { notIn: ["DONE", "CANCELLED"] } },
    }),
    prisma.task.count({
      where: { projectId: { in: projectIds }, dueDate: { lt: now }, status: { notIn: ["DONE", "CANCELLED"] } },
    }),
    prisma.reminderOccurrence.count({
      where: { reminder: { userId }, status: { in: ["PENDING", "SNOOZED"] }, nextFireAt: { gte: now, lte: upcomingEnd } },
    }),
    prisma.checklistItem.count({
      where: { status: "PENDING", task: { projectId: { in: projectIds } } },
    }),
    prisma.project.findMany({ where: { id: { in: projectIds } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.activityLog.findMany({
      where: { OR: [{ projectId: { in: projectIds } }, { task: { projectId: { in: projectIds } } }] },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const agg = await computeTaskAggregates(recentlyUpdatedProjectRows.map((p) => p.id));

  return {
    totalProjects,
    activeProjects,
    completedProjects,
    tasksDueToday,
    overdueTasks,
    upcomingReminders,
    pendingChecklists,
    recentlyUpdatedProjects: recentlyUpdatedProjectRows.map((p) => toWireProject(p, agg.get(p.id)!)),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      createdAt: a.createdAt.toISOString(),
      projectId: a.projectId,
      taskId: a.taskId,
    })),
  };
}

export async function getMyDay(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const now = new Date();
  const zoned = DateTime.fromJSDate(now, { zone: "utc" }).setZone(user.timezone);
  const todayStart = zoned.startOf("day").toUTC().toJSDate();
  const todayEnd = zoned.endOf("day").toUTC().toJSDate();

  const [todayRows, overdueRows, completedTodayRows, snoozedRows] = await Promise.all([
    prisma.reminderOccurrence.findMany({
      where: { reminder: { userId }, status: { in: ["PENDING", "SNOOZED"] }, nextFireAt: { gte: todayStart, lte: todayEnd } },
      include: { reminder: true },
      orderBy: { nextFireAt: "asc" },
    }),
    prisma.reminderOccurrence.findMany({
      where: { reminder: { userId }, status: { in: ["PENDING", "SNOOZED"] }, nextFireAt: { lt: todayStart } },
      include: { reminder: true },
      orderBy: { nextFireAt: "asc" },
    }),
    prisma.reminderOccurrence.findMany({
      where: {
        reminder: { userId },
        status: "CANCELLED",
        completedAt: { gte: todayStart, lte: todayEnd },
      },
      include: { reminder: true },
      orderBy: { nextFireAt: "asc" },
    }),
    prisma.reminderOccurrence.findMany({
      where: { reminder: { userId }, status: "SNOOZED" },
      include: { reminder: true },
      orderBy: { nextFireAt: "asc" },
    }),
  ]);

  const toItems = async (rows: typeof todayRows) =>
    Promise.all(
      rows.map(async (occ) => {
        const ctx = await resolveEntityContext(occ.reminder.entityType, occ.reminder.entityId);
        return {
          occurrenceId: occ.id,
          time: occ.nextFireAt.toISOString(),
          title: ctx.title,
          projectId: ctx.projectId,
          projectName: ctx.projectName,
          entityType: occ.reminder.entityType,
          entityId: occ.reminder.entityId,
        };
      })
    );

  const [today, overdue, completedToday, snoozed] = await Promise.all([
    toItems(todayRows),
    toItems(overdueRows),
    toItems(completedTodayRows),
    toItems(snoozedRows),
  ]);

  return { today, overdue, completedToday, snoozed };
}
