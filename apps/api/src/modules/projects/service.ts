// Projects CRUD + the computed fields every `Project` on the wire carries
// (durationDays/daysElapsed/daysRemaining/daysOverdue/completionPercent/task counts) —
// always derived from real Task state, never stored/editable (FR2).
import type { Prisma, Project, TaskStatus } from "@prisma/client";
import type { CreateProjectInput, UpdateProjectInput } from "@projectflow/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import { assertProjectAccess } from "../../lib/access";
import { diffInDays } from "../../lib/timezone";
import { parsePagination, toSkipTake } from "../../lib/pagination";
import { rescheduleRelativeOccurrences } from "../reminders/service";

const DONE: TaskStatus = "DONE";
const CANCELLED: TaskStatus = "CANCELLED";

interface TaskAggregate {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

interface WireTag {
  id: string;
  ownerId: string;
  name: string;
  color: string | null;
}

/** Batched (not N+1) lookup of each project's resolved Tag objects, for the
 * `Project.tags` field apps/web added to packages/shared/src/types.ts. */
export async function computeProjectTags(projectIds: string[]): Promise<Map<string, WireTag[]>> {
  const result = new Map<string, WireTag[]>();
  for (const id of projectIds) result.set(id, []);
  if (projectIds.length === 0) return result;

  const rows = await prisma.projectTag.findMany({
    where: { projectId: { in: projectIds } },
    include: { tag: true },
  });
  for (const row of rows) {
    result.get(row.projectId)!.push({
      id: row.tag.id,
      ownerId: row.tag.ownerId,
      name: row.tag.name,
      color: row.tag.color,
    });
  }
  return result;
}

export async function computeTaskAggregates(projectIds: string[]): Promise<Map<string, TaskAggregate>> {
  const result = new Map<string, TaskAggregate>();
  for (const id of projectIds) result.set(id, { total: 0, completed: 0, pending: 0, overdue: 0 });
  if (projectIds.length === 0) return result;

  const now = new Date();

  // Four bounded aggregate queries regardless of how many projects are in the page —
  // never one query per project (NFR1).
  const [totals, completed, pending, overdue] = await Promise.all([
    prisma.task.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds } }, _count: { _all: true } }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, status: DONE },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds }, status: { in: ["TODO", "IN_PROGRESS"] } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: projectIds },
        dueDate: { lt: now },
        status: { notIn: [DONE, CANCELLED] },
      },
      _count: { _all: true },
    }),
  ]);

  for (const row of totals) result.get(row.projectId)!.total = row._count._all;
  for (const row of completed) result.get(row.projectId)!.completed = row._count._all;
  for (const row of pending) result.get(row.projectId)!.pending = row._count._all;
  for (const row of overdue) result.get(row.projectId)!.overdue = row._count._all;

  return result;
}

function computeDateFields(project: Project) {
  const now = new Date();
  const end = project.targetEndDate ?? project.actualEndDate ?? now;
  const durationDays = Math.max(0, diffInDays(project.startDate, end));

  const elapsedEnd = project.actualEndDate && project.actualEndDate < now ? project.actualEndDate : now;
  const daysElapsed = Math.max(0, diffInDays(project.startDate, elapsedEnd));

  const isClosed = project.status === "COMPLETED" || project.status === "CANCELLED";
  const daysRemaining = project.targetEndDate ? Math.max(0, diffInDays(now, project.targetEndDate)) : null;
  const daysOverdue =
    project.targetEndDate && !isClosed && now > project.targetEndDate
      ? diffInDays(project.targetEndDate, now)
      : 0;

  return { durationDays, daysElapsed, daysRemaining, daysOverdue };
}

export function toWireProject(project: Project, agg: TaskAggregate, tags: WireTag[] = []) {
  const dateFields = computeDateFields(project);
  const completionPercent = agg.total === 0 ? 0 : Math.round((agg.completed / agg.total) * 100);
  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    description: project.description,
    startDate: project.startDate.toISOString(),
    targetEndDate: project.targetEndDate?.toISOString() ?? null,
    actualEndDate: project.actualEndDate?.toISOString() ?? null,
    status: project.status,
    priority: project.priority,
    color: project.color,
    notes: project.notes,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    ...dateFields,
    completionPercent,
    completedTaskCount: agg.completed,
    pendingTaskCount: agg.pending,
    overdueTaskCount: agg.overdue,
    // Added for packages/shared's `Project.tags?: Tag[]` (apps/web, additive).
    tags,
  };
}

export interface ListProjectsFilters {
  status?: string;
  priority?: string;
  tag?: string;
  search?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
}

export async function listProjects(userId: string, filters: ListProjectsFilters) {
  const { page, pageSize } = parsePagination(filters);

  const where: Prisma.ProjectWhereInput = {
    OR: [{ ownerId: userId }, { members: { some: { userId } } }],
  };
  if (filters.status) where.status = filters.status as Project["status"];
  if (filters.priority) where.priority = filters.priority as Project["priority"];
  if (filters.search) {
    where.AND = [{ OR: [{ name: { contains: filters.search, mode: "insensitive" } }, { description: { contains: filters.search, mode: "insensitive" } }] }];
  }
  if (filters.tag) {
    where.tags = { some: { tag: { name: filters.tag } } };
  }

  const sortMap: Record<string, Prisma.ProjectOrderByWithRelationInput> = {
    name: { name: "asc" },
    startDate: { startDate: "desc" },
    priority: { priority: "desc" },
    updatedAt: { updatedAt: "desc" },
  };
  const orderBy = sortMap[filters.sort ?? ""] ?? { updatedAt: "desc" };

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({ where, orderBy, ...toSkipTake({ page, pageSize }) }),
  ]);

  const [agg, tags] = await Promise.all([
    computeTaskAggregates(projects.map((p) => p.id)),
    computeProjectTags(projects.map((p) => p.id)),
  ]);
  const items = projects.map((p) => toWireProject(p, agg.get(p.id)!, tags.get(p.id)));

  return { items, total, page, pageSize };
}

export async function getProject(userId: string, id: string) {
  const project = await assertProjectAccess(userId, id);
  const [agg, tags] = await Promise.all([computeTaskAggregates([id]), computeProjectTags([id])]);
  return toWireProject(project, agg.get(id)!, tags.get(id));
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const project = await prisma.project.create({
    data: {
      ownerId: userId,
      name: input.name,
      description: input.description,
      startDate: new Date(input.startDate),
      targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : null,
      status: input.status,
      priority: input.priority,
      color: input.color,
      notes: input.notes,
      tags: input.tagIds ? { create: input.tagIds.map((tagId) => ({ tagId })) } : undefined,
    },
  });
  await prisma.activityLog.create({
    data: { projectId: project.id, userId, action: "project.created", metadata: { name: project.name } },
  });
  const [agg, tags] = await Promise.all([computeTaskAggregates([project.id]), computeProjectTags([project.id])]);
  return toWireProject(project, agg.get(project.id)!, tags.get(project.id));
}

export async function updateProject(userId: string, id: string, input: UpdateProjectInput) {
  const existing = await assertProjectAccess(userId, id);

  const project = await prisma.project.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      targetEndDate: input.targetEndDate !== undefined ? (input.targetEndDate ? new Date(input.targetEndDate) : null) : undefined,
      actualEndDate: input.actualEndDate !== undefined ? (input.actualEndDate ? new Date(input.actualEndDate) : null) : undefined,
      status: input.status,
      priority: input.priority,
      color: input.color,
      notes: input.notes,
    },
  });

  await prisma.activityLog.create({
    data: { projectId: id, userId, action: "project.updated", metadata: { fields: Object.keys(input) } },
  });

  // Reschedule relative (offsetBeforeDueMinutes) reminders attached directly to the
  // project if its own due date (targetEndDate) changed.
  if (input.targetEndDate !== undefined && project.targetEndDate?.getTime() !== existing.targetEndDate?.getTime()) {
    await prisma.$transaction((tx) => rescheduleRelativeOccurrences(tx, "PROJECT", id, project.targetEndDate));
  }

  // tagIds, when provided, replaces the full tag set (matches the web tag picker's
  // "set these tags" semantics rather than an additive merge).
  if (input.tagIds !== undefined) {
    await prisma.$transaction([
      prisma.projectTag.deleteMany({ where: { projectId: id } }),
      prisma.projectTag.createMany({ data: input.tagIds.map((tagId) => ({ projectId: id, tagId })) }),
    ]);
  }

  const [agg, tags] = await Promise.all([computeTaskAggregates([id]), computeProjectTags([id])]);
  return toWireProject(project, agg.get(id)!, tags.get(id));
}

export async function deleteProject(userId: string, id: string, force: boolean) {
  await assertProjectAccess(userId, id);
  const taskCount = await prisma.task.count({ where: { projectId: id } });
  if (taskCount > 0 && !force) {
    throw AppError.conflict("Project has tasks — pass ?force=true to delete anyway");
  }
  await prisma.project.delete({ where: { id } });
}

export async function getProjectActivity(userId: string, id: string) {
  await assertProjectAccess(userId, id);
  const rows = await prisma.activityLog.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  // Wire shape matches packages/shared's `ActivityEntry` (apps/web addition).
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    userId: row.userId,
    action: row.action,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  }));
}
