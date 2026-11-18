import bcrypt from "bcrypt";
import type { NotificationOutbox } from "@prisma/client";
import type { AdminCreateUserInput, AdminUpdateUserInput } from "@projectflow/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import { env } from "../../lib/env";
import { decodeChannels } from "../../lib/reminderChannels";
import { emailChannel } from "../../worker/channels/email";
import { whatsappChannel } from "../../worker/channels/whatsapp";
import type { OutboxPayload } from "../../worker/channels/types";

const BCRYPT_COST = 12;

function toAdminUser(u: {
  id: string; email: string; name: string; isAdmin: boolean; isActive: boolean; whatsappNumber: string | null;
  createdAt: Date; _count?: { ownedProjects: number; assignedTasks: number };
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    isAdmin: u.isAdmin,
    isActive: u.isActive,
    whatsappNumber: u.whatsappNumber,
    createdAt: u.createdAt.toISOString(),
    projectCount: u._count?.ownedProjects ?? 0,
    taskCount: u._count?.assignedTasks ?? 0,
  };
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { ownedProjects: true, assignedTasks: true } } },
  });
  return users.map(toAdminUser);
}

export async function createUser(input: AdminCreateUserInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existing) throw AppError.conflict("An account with this email already exists");
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_COST),
      isAdmin: input.isAdmin ?? false,
      whatsappNumber: input.whatsappNumber?.replace(/^\+/, "") ?? null,
    },
  });
  return toAdminUser(user);
}

export async function updateUser(targetUserId: string, requestingUserId: string, input: AdminUpdateUserInput) {
  const isSelf = targetUserId === requestingUserId;
  if (isSelf && input.isAdmin === false) throw AppError.badRequest("You cannot remove your own admin access");
  if (isSelf && input.isActive === false) throw AppError.badRequest("You cannot deactivate your own account");
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw AppError.notFound("User not found");

  // Never leave the system without an active admin.
  if ((input.isAdmin === false || input.isActive === false) && user.isAdmin) {
    const otherAdmins = await prisma.user.count({ where: { isAdmin: true, isActive: true, id: { not: targetUserId } } });
    if (otherAdmins === 0) throw AppError.badRequest("This is the last active admin — make someone else admin first");
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      name: input.name,
      isAdmin: input.isAdmin,
      isActive: input.isActive,
      whatsappNumber: input.whatsappNumber === undefined ? undefined : input.whatsappNumber?.replace(/^\+/, "") ?? null,
      passwordHash: input.password ? await bcrypt.hash(input.password, BCRYPT_COST) : undefined,
    },
  });
}

export async function deleteUser(targetUserId: string, requestingUserId: string) {
  if (targetUserId === requestingUserId) {
    throw AppError.badRequest("You cannot delete your own account");
  }
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { _count: { select: { ownedProjects: true } } },
  });
  if (!user) throw AppError.notFound("User not found");
  if (user._count.ownedProjects > 0) {
    throw AppError.conflict(
      `This user owns ${user._count.ownedProjects} project(s). Deactivate the account instead, so their projects are kept.`
    );
  }
  await prisma.$transaction(async (tx) => {
    // Rows that reference the user without a cascade.
    await tx.task.updateMany({ where: { assignedUserId: targetUserId }, data: { assignedUserId: null } });
    await tx.projectMember.deleteMany({ where: { userId: targetUserId } });
    await tx.reminder.deleteMany({ where: { userId: targetUserId } });
    await tx.activityLog.deleteMany({ where: { userId: targetUserId } });
    await tx.tag.deleteMany({ where: { ownerId: targetUserId } });
    await tx.checklistTemplate.deleteMany({ where: { ownerId: targetUserId } });
    await tx.user.delete({ where: { id: targetUserId } });
  });
}

export function getIntegrationsStatus() {
  return {
    email: {
      configured: Boolean(env.smtpHost),
      from: env.smtpFrom ?? null,
      host: env.smtpHost || null,
    },
    whatsapp: {
      configured: Boolean(env.whatsappAccessToken && env.whatsappPhoneNumberId),
    },
  };
}

// ---------- Reminders (all users) ----------

export async function listAllReminders() {
  const reminders = await prisma.reminder.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      occurrences: {
        where: { status: { in: ["PENDING", "SNOOZED", "PROCESSING"] } },
        orderBy: { nextFireAt: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const ids = (type: string) => reminders.filter((r) => r.entityType === type).map((r) => r.entityId);
  const [projects, tasks, items] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: ids("PROJECT") } }, select: { id: true, name: true } }),
    prisma.task.findMany({
      where: { id: { in: ids("TASK") } },
      select: { id: true, title: true, project: { select: { id: true, name: true } } },
    }),
    prisma.checklistItem.findMany({
      where: { id: { in: ids("CHECKLIST_ITEM") } },
      select: { id: true, title: true, task: { select: { project: { select: { id: true, name: true } } } } },
    }),
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  return reminders.map((r) => {
    let entityTitle = "(deleted)";
    let projectId = "";
    let projectName = "";
    if (r.entityType === "PROJECT") {
      const p = projectById.get(r.entityId);
      if (p) {
        entityTitle = p.name;
        projectId = p.id;
        projectName = p.name;
      }
    } else if (r.entityType === "TASK") {
      const t = taskById.get(r.entityId);
      if (t) {
        entityTitle = t.title;
        projectId = t.project.id;
        projectName = t.project.name;
      }
    } else {
      const i = itemById.get(r.entityId);
      if (i) {
        entityTitle = i.title;
        projectId = i.task.project.id;
        projectName = i.task.project.name;
      }
    }
    return {
      id: r.id,
      ownerId: r.user.id,
      ownerName: r.user.name,
      ownerEmail: r.user.email,
      entityType: r.entityType,
      entityId: r.entityId,
      entityTitle,
      projectId,
      projectName,
      type: r.type,
      channels: decodeChannels(r.channels),
      isActive: r.isActive,
      targetEmail: r.targetEmail,
      targetWhatsappNumber: r.targetWhatsappNumber,
      nextFireAt: r.isActive ? r.occurrences[0]?.nextFireAt.toISOString() ?? null : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Pause (cancels pending occurrences) or resume (schedules one occurrence now, which
 * the worker fires on its next tick and — for recurring reminders — reschedules). */
export async function setReminderActive(reminderId: string, isActive: boolean) {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder) throw AppError.notFound("Reminder not found");
  await prisma.$transaction(async (tx) => {
    await tx.reminder.update({ where: { id: reminderId }, data: { isActive } });
    if (!isActive) {
      await tx.reminderOccurrence.updateMany({
        where: { reminderId, status: { in: ["PENDING", "SNOOZED"] } },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
    } else {
      const pending = await tx.reminderOccurrence.count({
        where: { reminderId, status: { in: ["PENDING", "SNOOZED", "PROCESSING"] } },
      });
      if (pending === 0) {
        const fireAt =
          reminder.type === "ONE_TIME" && reminder.scheduledAt && reminder.scheduledAt > new Date()
            ? reminder.scheduledAt
            : new Date();
        await tx.reminderOccurrence.create({ data: { reminderId, nextFireAt: fireAt, status: "PENDING" } });
      }
    }
  });
}

// ---------- Delivery log ----------

export async function listDeliveries() {
  const rows = await prisma.notificationDelivery.findMany({
    include: { outbox: { select: { payload: true } } },
    orderBy: { attemptedAt: "desc" },
    take: 200,
  });
  return rows.map((d) => {
    const payload = d.outbox.payload as unknown as Partial<OutboxPayload>;
    const provider = (d.providerResponse ?? {}) as { simulated?: boolean };
    const target =
      d.channel === "EMAIL"
        ? payload.targetEmail ?? null
        : d.channel === "WHATSAPP"
          ? payload.targetWhatsappNumber ?? null
          : payload.userName ?? null;
    return {
      id: d.id,
      channel: d.channel,
      status: d.status,
      simulated: provider.simulated === true,
      target,
      title: payload.title ?? null,
      error: d.error,
      attemptedAt: d.attemptedAt.toISOString(),
    };
  });
}

// ---------- Test sends ----------

/** Sends one real message through the same channel adapter the worker uses, so this
 * proves the actual SMTP / WhatsApp configuration end to end. */
export async function sendTestNotification(channel: "EMAIL" | "WHATSAPP", to: string, adminName: string) {
  const payload: OutboxPayload = {
    occurrenceId: "test",
    reminderId: "test",
    userId: "test",
    userEmail: channel === "EMAIL" ? to : "",
    userName: adminName,
    targetEmail: channel === "EMAIL" ? to : "",
    targetWhatsappNumber: channel === "WHATSAPP" ? to.replace(/^\+/, "") : null,
    entityType: "PROJECT",
    entityId: "test",
    entityTitle: "Test",
    projectId: "test",
    projectName: "ProjectFlow",
    nextFireAt: new Date().toISOString(),
    title: "ProjectFlow test notification",
    message: `This is a test message sent by ${adminName} from the ProjectFlow admin page. If you received it, ${channel === "EMAIL" ? "email" : "WhatsApp"} reminders are working.`,
    wasStale: false,
  };
  const fakeOutbox = { id: "test", payload, channel } as unknown as NotificationOutbox;
  const adapter = channel === "EMAIL" ? emailChannel : whatsappChannel;
  const result = await adapter.send(fakeOutbox);
  let detail: string;
  if (!result.ok) detail = result.error ?? "Send failed";
  else if (result.simulated) {
    detail =
      channel === "EMAIL"
        ? "SMTP is not configured (SMTP_HOST is empty) — nothing was actually sent."
        : "WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID) — nothing was actually sent.";
  } else detail = `Sent to ${to}.`;
  return { ok: result.ok, simulated: !!result.simulated, detail };
}
