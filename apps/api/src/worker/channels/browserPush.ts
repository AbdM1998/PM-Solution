import type { NotificationOutbox } from "@prisma/client";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import type { ChannelAdapter, ChannelSendResult, OutboxPayload } from "./types";

// Browser Web Push (VAPID) adapter. Scaffolded, not live: no VAPID keypair has been
// generated for this session. No-ops (logs) instead of throwing or faking delivery
// when WEBPUSH_VAPID_PRIVATE_KEY is absent. A real implementation would use the
// `web-push` library with these keys; omitted from dependencies since it can never be
// exercised without them in this session.
export const browserPushChannel: ChannelAdapter = {
  channel: "BROWSER_PUSH",
  isConfigured() {
    return env.webPushVapidPrivateKey.length > 0 && env.webPushVapidPublicKey.length > 0;
  },
  async send(outbox: NotificationOutbox): Promise<ChannelSendResult> {
    const payload = outbox.payload as unknown as OutboxPayload;
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: payload.userId } });

    if (!this.isConfigured()) {
      logger.info("Web Push not configured — no-op (would have pushed)", {
        userId: payload.userId,
        subscriptionCount: subscriptions.length,
      });
      return {
        ok: true,
        simulated: true,
        providerResponse: {
          simulated: true,
          reason: "WEBPUSH_VAPID_PUBLIC_KEY/WEBPUSH_VAPID_PRIVATE_KEY not set",
          subscriptionCount: subscriptions.length,
        },
      };
    }

    // Real call path intentionally unreachable in this session (no VAPID keys / no
    // `web-push` dependency added, since it would never be exercised).
    return {
      ok: true,
      simulated: true,
      providerResponse: { simulated: true, reason: "browser push send not implemented beyond adapter interface" },
    };
  },
};
