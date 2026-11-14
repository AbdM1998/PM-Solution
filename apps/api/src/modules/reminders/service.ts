// The reminder engine's rule layer. Keeps Reminder (rule) / ReminderOccurrence (one
// concrete instant) strictly separate per docs/REMINDER_ENGINE.md. The worker
// (src/worker/scheduler.ts) owns claiming + firing occurrences; this service owns
// everything a user/API request can do: create/edit/delete a rule, snooze/complete a
// specific occurrence, and the two invariants other modules call into:
//   - cancelPendingOccurrencesForEntity (completing a task/checklist item)
//   - rescheduleRelativeOccurrences (editing a task/checklist item's due date)
import type { OccurrenceStatus, Prisma, ReminderEntityType } from "@prisma/client";
import type { CreateReminderInput, SnoozeOccurrenceInput } from "@projectflow/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import { assertEntityAccess, resolveEntityContext } from "../../lib/access";
import { computeNextRecurrence, computeSnoozeFireAt } from "../../lib/timezone";
import { encodeChannels, decodeChannels } from "../../lib/reminderChannels";

type Tx = Prisma.TransactionClient;

const RECURRING_TYPES = new Set(["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"]);

function computeInitialFireAt(
  input: Pick<CreateReminderInput, "type" | "scheduledAt" | "offsetBeforeDueMinutes">,
  dueDate: Date | null
): Date {
  if (input.scheduledAt) return new Date(input.scheduledAt);
  if (input.offsetBeforeDueMinutes != null) {
    if (!dueDate) {
      throw AppError.badRequest(
        "offsetBeforeDueMinutes requires the target entity to already have a due date"
      );
    }
    return new Date(dueDate.getTime() - input.offsetBeforeDueMinutes * 60_000);
  }
  // Recurring reminder with no explicit anchor: start counting from now.
  return new Date();
}

export async function createReminder(userId: string, input: CreateReminderInput) {
  const ctx = await assertEntityAccess(userId, input.entityType, input.entityId);

  if (input.type === "CUSTOM" && !input.recurrenceRule) {
    throw AppError.badRequest("CUSTOM reminders require recurrenceRule");
  }

  const nextFireAt = computeInitialFireAt(input, ctx.dueDate);

  const reminder = await prisma.reminder.create({
    data: {
      userId,
      entityType: input.entityType,
      entityId: input.entityId,
      type: input.type,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      recurrenceRule: input.recurrenceRule ?? null,
      offsetBeforeDueMinutes: input.offsetBeforeDueMinutes ?? null,
      channels: encodeChannels(input.channels),
      targetEmail: input.targetEmail ?? null,
      targetWhatsappNumber: input.targetWhatsappNumber ?? null,
      occurrences: {
        create: [{ nextFireAt, status: "PENDING" }],
      },
    },
    include: { occurrences: true },
  });
  return { ...reminder, channels: decodeChannels(reminder.channels) };
}

export async function listReminders(userId: string, entityType: ReminderEntityType, entityId: string) {
  await assertEntityAccess(userId, entityType, entityId);
  const reminders = await prisma.reminder.findMany({
    where: { entityType, entityId, userId },
    orderBy: { createdAt: "desc" },
  });
  return reminders.map((r) => ({ ...r, channels: decodeChannels(r.channels) }));
}

async function getOwnedReminder(userId: string, reminderId: string) {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder) throw AppError.notFound("Reminder not found");
  // Re-validates the underlying entity is still in a project this user can access —
  // guards against a reminder surviving a project membership change.
  await assertEntityAccess(userId, reminder.entityType, reminder.entityId);
  if (reminder.userId !== userId) throw AppError.forbidden("You do not own this reminder");
  return reminder;
}

export async function updateReminder(
  userId: string,
  reminderId: string,
  input: Partial<CreateReminderInput> & { isActive?: boolean }
) {
  const reminder = await getOwnedReminder(userId, reminderId);

  const nextType = input.type ?? reminder.type;
  const nextOffset = input.offsetBeforeDueMinutes ?? reminder.offsetBeforeDueMinutes;
  const nextScheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : reminder.scheduledAt;
  const nextRecurrenceRule = input.recurrenceRule ?? reminder.recurrenceRule;

  const schedulingChanged =
    input.type !== undefined ||
    input.scheduledAt !== undefined ||
    input.offsetBeforeDueMinutes !== undefined ||
    input.recurrenceRule !== undefined;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.reminder.update({
      where: { id: reminderId },
      data: {
        type: nextType,
        scheduledAt: nextScheduledAt,
        recurrenceRule: nextRecurrenceRule,
        offsetBeforeDueMinutes: nextOffset,
        channels: input.channels ? encodeChannels(input.channels) : reminder.channels,
        isActive: input.isActive ?? reminder.isActive,
      },
    });

    if (schedulingChanged) {
      const ctx = await resolveEntityContext(reminder.entityType, reminder.entityId);
      const newFireAt = computeInitialFireAt(
        { type: nextType, scheduledAt: nextScheduledAt?.toISOString(), offsetBeforeDueMinutes: nextOffset ?? undefined },
        ctx.dueDate
      );
      await tx.reminderOccurrence.updateMany({
        where: { reminderId, status: { in: ["PENDING", "SNOOZED"] } },
        data: { nextFireAt: newFireAt, status: "PENDING" },
      });
    }

    return updated;
  }).then((updated) => ({ ...updated, channels: decodeChannels(updated.channels) }));
}

/** DELETE /reminders/:id — soft delete: deactivates the rule and cancels future
 * occurrences, but keeps the Reminder row (and its history) rather than hard-deleting,
 * per FR5 "full history kept". */
export async function deleteReminder(userId: string, reminderId: string) {
  await getOwnedReminder(userId, reminderId);
  await prisma.$transaction(async (tx) => {
    await tx.reminderOccurrence.updateMany({
      where: { reminderId, status: { in: ["PENDING", "SNOOZED"] } },
      data: { status: "CANCELLED" },
    });
    await tx.reminder.update({ where: { id: reminderId }, data: { isActive: false } });
  });
}

export interface OccurrenceListFilters {
  status?: string;
  from?: string;
  to?: string;
}

export async function listOccurrences(userId: string, filters: OccurrenceListFilters) {
  const where: Prisma.ReminderOccurrenceWhereInput = {
    reminder: { userId },
  };
  if (filters.status) where.status = filters.status as OccurrenceStatus;
  if (filters.from || filters.to) {
    where.nextFireAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  const occurrences = await prisma.reminderOccurrence.findMany({
    where,
    include: { reminder: true },
    orderBy: { nextFireAt: "asc" },
    take: 500,
  });

  // Denormalize entity title / project for list views (Dashboard/My Day/Calendar),
  // batched per entity type rather than N+1 per occurrence.
  return attachEntityContext(occurrences);
}

async function attachEntityContext(
  occurrences: Array<Prisma.ReminderOccurrenceGetPayload<{ include: { reminder: true } }>>
) {
  const projectIds = new Set<string>();
  const taskIds = new Set<string>();
  const checklistItemIds = new Set<string>();
  for (const occ of occurrences) {
    if (occ.reminder.entityType === "PROJECT") projectIds.add(occ.reminder.entityId);
    if (occ.reminder.entityType === "TASK") taskIds.add(occ.reminder.entityId);
    if (occ.reminder.entityType === "CHECKLIST_ITEM") checklistItemIds.add(occ.reminder.entityId);
  }

  const [projects, tasks, checklistItems] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: [...projectIds] } } }),
    prisma.task.findMany({ where: { id: { in: [...taskIds] } }, include: { project: true } }),
    prisma.checklistItem.findMany({
      where: { id: { in: [...checklistItemIds] } },
      include: { task: { include: { project: true } } },
    }),
  ]);

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const itemById = new Map(checklistItems.map((i) => [i.id, i]));

  return occurrences.map((occ) => {
    const { entityType, entityId } = occ.reminder;
    let entityTitle = "";
    let projectId = "";
    let projectName = "";
    if (entityType === "PROJECT") {
      const p = projectById.get(entityId);
      entityTitle = p?.name ?? "";
      projectId = p?.id ?? "";
      projectName = p?.name ?? "";
    } else if (entityType === "TASK") {
      const t = taskById.get(entityId);
      entityTitle = t?.title ?? "";
      projectId = t?.projectId ?? "";
      projectName = t?.project.name ?? "";
    } else {
      const i = itemById.get(entityId);
      entityTitle = i?.title ?? "";
      projectId = i?.task.projectId ?? "";
      projectName = i?.task.project.name ?? "";
    }
    return {
      id: occ.id,
      reminderId: occ.reminderId,
      nextFireAt: occ.nextFireAt,
      status: occ.status,
      entityType,
      entityId,
      entityTitle,
      projectId,
      projectName,
    };
  });
}

async function getOwnedOccurrence(userId: string, occurrenceId: string) {
  const occurrence = await prisma.reminderOccurrence.findUnique({
    where: { id: occurrenceId },
    include: { reminder: true },
  });
  if (!occurrence) throw AppError.notFound("Occurrence not found");
  if (occurrence.reminder.userId !== userId) throw AppError.forbidden("You do not own this reminder");
  return occurrence;
}

/**
 * Snooze invariant: only ReminderOccurrence.nextFireAt moves, plus a SnoozeHistory row.
 * The source Task/ChecklistItem/Project due date is never touched here.
 */
export async function snoozeOccurrence(userId: string, occurrenceId: string, input: SnoozeOccurrenceInput) {
  const occurrence = await getOwnedOccurrence(userId, occurrenceId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const newFireAt = computeSnoozeFireAt(input.option, {
    customAt: input.customAt ? new Date(input.customAt) : undefined,
    timezone: user.timezone,
  });

  return prisma.$transaction(async (tx) => {
    await tx.snoozeHistory.create({
      data: {
        occurrenceId,
        previousFireAt: occurrence.nextFireAt,
        newFireAt,
        snoozeOptionLabel: input.option,
      },
    });
    return tx.reminderOccurrence.update({
      where: { id: occurrenceId },
      data: { status: "SNOOZED", nextFireAt: newFireAt, lockedBy: null, lockedAt: null },
    });
  });
}

/** POST /occurrences/:id/complete — user manually dismisses/acknowledges one occurrence. */
export async function completeOccurrence(userId: string, occurrenceId: string) {
  await getOwnedOccurrence(userId, occurrenceId);
  return prisma.reminderOccurrence.update({
    where: { id: occurrenceId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
}

/**
 * Completing a checklist item/task cancels its pending occurrences (FR6 / the
 * invariant in docs/REMINDER_ENGINE.md). Must run inside the caller's transaction so
 * it's atomic with the entity's own completion write.
 */
export async function cancelPendingOccurrencesForEntity(
  tx: Tx,
  entityType: ReminderEntityType,
  entityId: string
) {
  const reminders = await tx.reminder.findMany({ where: { entityType, entityId }, select: { id: true } });
  if (reminders.length === 0) return;
  await tx.reminderOccurrence.updateMany({
    where: { reminderId: { in: reminders.map((r) => r.id) }, status: { in: ["PENDING", "SNOOZED"] } },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
}

/**
 * Editing a due date reschedules a relative (offsetBeforeDueMinutes) reminder's
 * pending occurrence in place instead of creating a second one.
 */
export async function rescheduleRelativeOccurrences(
  tx: Tx,
  entityType: ReminderEntityType,
  entityId: string,
  newDueDate: Date | null
) {
  const reminders = await tx.reminder.findMany({
    where: { entityType, entityId, offsetBeforeDueMinutes: { not: null }, isActive: true },
  });
  for (const reminder of reminders) {
    if (!newDueDate || reminder.offsetBeforeDueMinutes == null) continue;
    const newFireAt = new Date(newDueDate.getTime() - reminder.offsetBeforeDueMinutes * 60_000);
    await tx.reminderOccurrence.updateMany({
      where: { reminderId: reminder.id, status: { in: ["PENDING", "SNOOZED"] } },
      data: { nextFireAt: newFireAt, status: "PENDING" },
    });
  }
}

export { computeNextRecurrence, RECURRING_TYPES };
