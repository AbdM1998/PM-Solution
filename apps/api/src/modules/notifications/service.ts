// In-app notification inbox. There is no separate "Notification" table in the schema —
// IN_APP-channel NotificationOutbox rows double as the inbox (see the `readAt` field
// added to that model, documented in schema.prisma and the final delivery report).
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import type { OutboxPayload } from "../../worker/channels/types";

// Wire shape matches packages/shared's `AppNotification` (apps/mobile addition:
// id, title, body?, isRead, createdAt, entityType?/entityId?/projectId?/projectName?).
// `wasStale`/`outboxStatus` are additive extra fields beyond that contract — harmless
// for clients that only read the documented AppNotification fields.
function toWireNotification(row: { id: string; payload: unknown; status: string; createdAt: Date; readAt: Date | null }) {
  const payload = row.payload as unknown as OutboxPayload;
  return {
    id: row.id,
    title: payload.title,
    body: payload.message,
    isRead: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
    entityType: payload.entityType,
    entityId: payload.entityId,
    projectId: payload.projectId,
    projectName: payload.projectName,
    wasStale: payload.wasStale,
    outboxStatus: row.status,
  };
}

export async function listNotifications(userId: string, unreadOnly: boolean) {
  const rows = await prisma.notificationOutbox.findMany({
    where: {
      channel: "IN_APP",
      occurrence: { reminder: { userId } },
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(toWireNotification);
}

async function getOwnedOutboxRow(userId: string, id: string) {
  const row = await prisma.notificationOutbox.findUnique({
    where: { id },
    include: { occurrence: { include: { reminder: true } } },
  });
  if (!row) throw AppError.notFound("Notification not found");
  if (row.occurrence.reminder.userId !== userId) throw AppError.forbidden("Not your notification");
  return row;
}

export async function markRead(userId: string, id: string) {
  await getOwnedOutboxRow(userId, id);
  await prisma.notificationOutbox.update({ where: { id }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: string) {
  await prisma.notificationOutbox.updateMany({
    where: { channel: "IN_APP", occurrence: { reminder: { userId } }, readAt: null },
    data: { readAt: new Date() },
  });
}
