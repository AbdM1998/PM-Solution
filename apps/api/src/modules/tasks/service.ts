import type { Prisma, Task } from "@prisma/client";
import type { CreateTaskInput, UpdateTaskInput } from "@projectflow/shared";
import { prisma } from "../../lib/prisma";
import { assertProjectAccess, assertTaskAccess } from "../../lib/access";
import { parsePagination, toSkipTake } from "../../lib/pagination";
import { cancelPendingOccurrencesForEntity, rescheduleRelativeOccurrences } from "../reminders/service";

export function toWireTask(task: Task) {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    startDate: task.startDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    assignedUserId: task.assignedUserId,
    orderIndex: task.orderIndex,
    notes: task.notes,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export interface ListTasksFilters {
  status?: string;
  priority?: string;
  assignee?: string;
  tag?: string;
  search?: string;
  page?: string;
  pageSize?: string;
}

export async function listTasks(userId: string, projectId: string, filters: ListTasksFilters) {
  await assertProjectAccess(userId, projectId);
  const { page, pageSize } = parsePagination(filters);

  const where: Prisma.TaskWhereInput = { projectId };
  if (filters.status) where.status = filters.status as Task["status"];
  if (filters.priority) where.priority = filters.priority as Task["priority"];
  if (filters.assignee) where.assignedUserId = filters.assignee;
  if (filters.tag) where.tags = { some: { tag: { name: filters.tag } } };
  if (filters.search) where.title = { contains: filters.search, mode: "insensitive" };

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({ where, orderBy: { orderIndex: "asc" }, ...toSkipTake({ page, pageSize }) }),
  ]);

  return { items: tasks.map(toWireTask), total, page, pageSize };
}

export async function createTask(userId: string, projectId: string, input: CreateTaskInput) {
  await assertProjectAccess(userId, projectId);
  const maxOrder = await prisma.task.aggregate({ where: { projectId }, _max: { orderIndex: true } });
  const task = await prisma.task.create({
    data: {
      projectId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assignedUserId: input.assignedUserId,
      notes: input.notes,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
    },
  });
  await prisma.activityLog.create({
    data: { projectId, taskId: task.id, userId, action: "task.created", metadata: { title: task.title } },
  });
  return toWireTask(task);
}

export async function getTask(userId: string, taskId: string) {
  const task = await assertTaskAccess(userId, taskId);
  return toWireTask(task);
}

export async function updateTask(userId: string, taskId: string, input: UpdateTaskInput) {
  const existing = await assertTaskAccess(userId, taskId);

  const becomingDone = input.status === "DONE" && existing.status !== "DONE";
  const newDueDate = input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : undefined;

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        dueDate: newDueDate,
        assignedUserId: input.assignedUserId,
        notes: input.notes,
        completedAt: becomingDone ? new Date() : input.status && input.status !== "DONE" ? null : undefined,
      },
    });

    if (becomingDone) {
      await cancelPendingOccurrencesForEntity(tx, "TASK", taskId);
    }
    if (newDueDate !== undefined && newDueDate?.getTime() !== existing.dueDate?.getTime()) {
      await rescheduleRelativeOccurrences(tx, "TASK", taskId, newDueDate);
    }

    return updated;
  });

  await prisma.activityLog.create({
    data: { projectId: task.projectId, taskId, userId, action: "task.updated", metadata: { fields: Object.keys(input) } },
  });

  return toWireTask(task);
}

export async function deleteTask(userId: string, taskId: string) {
  await assertTaskAccess(userId, taskId);
  await prisma.task.delete({ where: { id: taskId } });
}

export async function duplicateTask(userId: string, taskId: string) {
  const original = await assertTaskAccess(userId, taskId);
  const items = await prisma.checklistItem.findMany({ where: { taskId }, orderBy: { orderIndex: "asc" } });

  const maxOrder = await prisma.task.aggregate({
    where: { projectId: original.projectId },
    _max: { orderIndex: true },
  });

  return prisma.$transaction(async (tx) => {
    const copy = await tx.task.create({
      data: {
        projectId: original.projectId,
        title: `${original.title} (copy)`,
        description: original.description,
        priority: original.priority,
        status: "TODO",
        startDate: original.startDate,
        dueDate: original.dueDate,
        notes: original.notes,
        orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      },
    });

    // Recreate checklist items preserving nesting: process in passes so a parent is
    // always created before any child that references it.
    const idMap = new Map<string, string>();
    let remaining = [...items];
    while (remaining.length > 0) {
      const creatable = remaining.filter((i) => i.parentId === null || idMap.has(i.parentId));
      if (creatable.length === 0) break; // orphaned reference safety valve
      for (const item of creatable) {
        const created = await tx.checklistItem.create({
          data: {
            taskId: copy.id,
            parentId: item.parentId ? idMap.get(item.parentId) : null,
            title: item.title,
            description: item.description,
            priority: item.priority,
            status: "PENDING",
            dueDate: item.dueDate,
            orderIndex: item.orderIndex,
            notes: item.notes,
          },
        });
        idMap.set(item.id, created.id);
      }
      remaining = remaining.filter((i) => !idMap.has(i.id));
    }

    return toWireTask(copy);
  });
}

export async function reorderTasks(userId: string, items: { taskId: string; newIndex: number }[]) {
  for (const { taskId } of items) {
    await assertTaskAccess(userId, taskId);
  }
  await prisma.$transaction(
    items.map(({ taskId, newIndex }) => prisma.task.update({ where: { id: taskId }, data: { orderIndex: newIndex } }))
  );
}

export async function bulkCompleteTasks(userId: string, taskIds: string[]) {
  for (const id of taskIds) {
    await assertTaskAccess(userId, id);
  }
  await prisma.$transaction(async (tx) => {
    for (const id of taskIds) {
      await tx.task.update({ where: { id }, data: { status: "DONE", completedAt: new Date() } });
      await cancelPendingOccurrencesForEntity(tx, "TASK", id);
    }
  });
}
