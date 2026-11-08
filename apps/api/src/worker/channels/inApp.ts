import type { NotificationOutbox } from "@prisma/client";
import type { ChannelAdapter, ChannelSendResult, OutboxPayload } from "./types";
import { emitToUser } from "../../modules/notifications/socket";

// In-App channel: fully implemented and live (no external credentials needed).
// Delivery is always persisted in NotificationOutbox/NotificationDelivery regardless
// of whether a socket is currently connected, so the in-app feed (`GET /notifications`)
// works even if the user's browser was closed when it fired; the socket emit below is
// purely a best-effort real-time nudge on top of that durable record.
export const inAppChannel: ChannelAdapter = {
  channel: "IN_APP",
  isConfigured() {
    return true;
  },
  async send(outbox: NotificationOutbox): Promise<ChannelSendResult> {
    const payload = outbox.payload as unknown as OutboxPayload;
    emitToUser(payload.userId, "notification:new", {
      outboxId: outbox.id,
      title: payload.title,
      message: payload.message,
      entityType: payload.entityType,
      entityId: payload.entityId,
      projectId: payload.projectId,
      projectName: payload.projectName,
      wasStale: payload.wasStale,
      nextFireAt: payload.nextFireAt,
    });
    return { ok: true, providerResponse: { delivered: "persisted+socket-best-effort" } };
  },
};
