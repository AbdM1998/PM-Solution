import type { ChecklistItem } from "@prisma/client";
import type { CreateChecklistItemInput, UpdateChecklistItemInput, CreateChecklistTemplateInput } from "@projectflow/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import { assertTaskAccess, assertChecklistItemAccess } from "../../lib/access";
import { cancelPendingOccurrencesForEntity, rescheduleRelativeOccurrences } from "../reminders/service";

export function toWireChecklistItem(item: ChecklistItem) {
  return {
    id: item.id,
    taskId: item.taskId,
    parentId: item.parentId,
    title: item.title,
    description: item.description,
    status: item.status,
    priority: item.priority,
    dueDate: item.dueDate?.toISOString() ?? null,
    completedAt: item.completedAt?.toISOString() ?? null,
    orderIndex: item.orderIndex,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function listChecklistItems(userId: string, taskId: string) {
  await assertTaskAccess(userId, taskId);
  const items = await prisma.checklistItem.findMany({ where: { taskId }, orderBy: { orderIndex: "asc" } });
  return items.map(toWireChecklistItem);
}

/** A DONE task must never end up with open checklist items (closing it required them
 * all to be completed), so adding or reopening items needs the task reopened first. */
function assertTaskOpen(task: { status: string; title: string }) {
  if (task.status === "DONE") {
    throw new AppError(409, "TASK_CLOSED", `Task "${task.title}" is closed — reopen it before changing its checklist`);
  }
}

export async function createChecklistItem(userId: string, taskId: string, input: CreateChecklistItemInput) {
  const task = await assertTaskAccess(userId, taskId);
  assertTaskOpen(task);
  if (input.parentId) {
    const parent = await prisma.checklistItem.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.taskId !== taskId) throw AppError.badRequest("parentId must belong to the same task");
  }
  const maxOrder = await prisma.checklistItem.aggregate({ where: { taskId }, _max: { orderIndex: true } });
  const item = await prisma.checklistItem.create({
    data: {
      taskId,
      parentId: input.parentId ?? null,
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
    },
  });
  return toWireChecklistItem(item);
}

export async function updateChecklistItem(userId: string, itemId: string, input: UpdateChecklistItemInput) {
  const { item: existing, task } = await assertChecklistItemAccess(userId, itemId);

  const becomingCompleted = input.status === "COMPLETED" && existing.status !== "COMPLETED";
  const becomingReopened = input.status === "PENDING" && existing.status === "COMPLETED";
  if (becomingReopened) assertTaskOpen(task);
  const newDueDate = input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : undefined;

  if (input.parentId) {
    const parent = await prisma.checklistItem.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.taskId !== existing.taskId) throw AppError.badRequest("parentId must belong to the same task");
    if (input.parentId === itemId) throw AppError.badRequest("An item cannot be its own parent");
  }

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.checklistItem.update({
      where: { id: itemId },
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        parentId: input.parentId,
        dueDate: newDueDate,
        orderIndex: input.orderIndex,
        notes: input.notes,
        completedAt: becomingCompleted ? new Date() : becomingReopened ? null : undefined,
      },
    });

    if (becomingCompleted) {
      await cancelPendingOccurrencesForEntity(tx, "CHECKLIST_ITEM", itemId);
    }
    if (newDueDate !== undefined && newDueDate?.getTime() !== existing.dueDate?.getTime()) {
      await rescheduleRelativeOccurrences(tx, "CHECKLIST_ITEM", itemId, newDueDate);
    }

    return updated;
  });

  return toWireChecklistItem(item);
}

/** POST /checklist-items/:id/complete — cancels pending ReminderOccurrences (FR6). */
export async function completeChecklistItem(userId: string, itemId: string) {
  const { item: existing } = await assertChecklistItemAccess(userId, itemId);
  if (existing.status === "COMPLETED") return toWireChecklistItem(existing);

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.checklistItem.update({
      where: { id: itemId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await cancelPendingOccurrencesForEntity(tx, "CHECKLIST_ITEM", itemId);
    return updated;
  });

  return toWireChecklistItem(item);
}

export async function deleteChecklistItem(userId: string, itemId: string) {
  await assertChecklistItemAccess(userId, itemId);
  await prisma.checklistItem.delete({ where: { id: itemId } });
}

export async function reorderChecklistItems(userId: string, items: { itemId: string; newIndex: number }[]) {
  for (const { itemId } of items) {
    await assertChecklistItemAccess(userId, itemId);
  }
  await prisma.$transaction(
    items.map(({ itemId, newIndex }) =>
      prisma.checklistItem.update({ where: { id: itemId }, data: { orderIndex: newIndex } })
    )
  );
}

export async function bulkCompleteChecklistItems(userId: string, itemIds: string[]) {
  for (const id of itemIds) {
    await assertChecklistItemAccess(userId, id);
  }
  await prisma.$transaction(async (tx) => {
    for (const id of itemIds) {
      await tx.checklistItem.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await cancelPendingOccurrencesForEntity(tx, "CHECKLIST_ITEM", id);
    }
  });
}

// ---------- Templates ----------

export async function listChecklistTemplates(userId: string) {
  const templates = await prisma.checklistTemplate.findMany({
    where: { ownerId: userId },
    include: { items: { orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    items: t.items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      orderIndex: i.orderIndex,
      defaultPriority: i.defaultPriority,
    })),
  }));
}

export async function createChecklistTemplate(userId: string, input: CreateChecklistTemplateInput) {
  const template = await prisma.checklistTemplate.create({
    data: {
      ownerId: userId,
      name: input.name,
      description: input.description,
      items: {
        create: input.items.map((i) => ({
          title: i.title,
          description: i.description,
          orderIndex: i.orderIndex,
          defaultPriority: i.defaultPriority,
        })),
      },
    },
    include: { items: { orderBy: { orderIndex: "asc" } } },
  });
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    items: template.items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      orderIndex: i.orderIndex,
      defaultPriority: i.defaultPriority,
    })),
  };
}

export async function applyChecklistTemplate(userId: string, templateId: string, taskId: string) {
  const task = await assertTaskAccess(userId, taskId);
  assertTaskOpen(task);
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { orderIndex: "asc" } } },
  });
  if (!template || template.ownerId !== userId) throw AppError.notFound("Template not found");

  const maxOrder = await prisma.checklistItem.aggregate({ where: { taskId }, _max: { orderIndex: true } });
  let nextOrder = (maxOrder._max.orderIndex ?? -1) + 1;

  const created = await prisma.$transaction(
    template.items.map((templateItem) =>
      prisma.checklistItem.create({
        data: {
          taskId,
          title: templateItem.title,
          description: templateItem.description,
          priority: templateItem.defaultPriority,
          orderIndex: nextOrder++,
        },
      })
    )
  );

  return created.map(toWireChecklistItem);
}
