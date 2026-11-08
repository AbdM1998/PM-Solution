import type { NotificationOutbox } from "@prisma/client";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import type { ChannelAdapter, ChannelSendResult, OutboxPayload } from "./types";

// Mobile push (FCM/APNs) adapter. Scaffolded, not live: no FCM server key / APNs
// certificate exists for this session. No-ops (logs) instead of throwing or faking a
// delivered push when FCM_SERVER_KEY is absent.
export const pushChannel: ChannelAdapter = {
  channel: "PUSH",
  isConfigured() {
    return env.fcmServerKey.length > 0;
  },
  async send(outbox: NotificationOutbox): Promise<ChannelSendResult> {
    const payload = outbox.payload as unknown as OutboxPayload;
    const tokens = await prisma.deviceToken.findMany({ where: { userId: payload.userId } });

    if (!this.isConfigured()) {
      logger.info("FCM not configured — no-op (would have pushed)", {
        userId: payload.userId,
        deviceCount: tokens.length,
      });
      return {
        ok: true,
        simulated: true,
        providerResponse: { simulated: true, reason: "FCM_SERVER_KEY not set", deviceCount: tokens.length },
      };
    }

    if (tokens.length === 0) {
      return { ok: true, simulated: true, providerResponse: { simulated: true, reason: "no registered devices" } };
    }

    try {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: { Authorization: `key=${env.fcmServerKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_ids: tokens.map((t) => t.token),
          notification: { title: payload.title, body: payload.message },
        }),
      });
      const body = await res.json();
      if (!res.ok) return { ok: false, error: `FCM ${res.status}`, providerResponse: body };
      return { ok: true, providerResponse: body };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
