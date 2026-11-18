import type { NotificationOutbox } from "@prisma/client";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { ChannelAdapter, ChannelSendResult, OutboxPayload } from "./types";

// WhatsApp Business Cloud API adapter. Scaffolded, not live: requires a verified
// WhatsApp Business phone number + approved message template, which don't exist for
// this user/session (see docs/TECHNOLOGY_DECISIONS.md). When WHATSAPP_ACCESS_TOKEN /
// WHATSAPP_PHONE_NUMBER_ID are absent, this adapter logs and no-ops instead of
// throwing or pretending a message was sent.
export const whatsappChannel: ChannelAdapter = {
  channel: "WHATSAPP",
  isConfigured() {
    return env.whatsappAccessToken.length > 0 && env.whatsappPhoneNumberId.length > 0;
  },
  async send(outbox: NotificationOutbox): Promise<ChannelSendResult> {
    const payload = outbox.payload as unknown as OutboxPayload;

    // There is no account-level WhatsApp number to fall back to — unlike EMAIL, a
    // reminder with no targetWhatsappNumber override has nowhere to send at all, so
    // this is reported as simulated/no-op even when credentials ARE configured.
    if (!payload.targetWhatsappNumber) {
      logger.info("WhatsApp: no target number set on this reminder — no-op", {
        reminderId: payload.reminderId,
        title: payload.title,
      });
      return {
        ok: true,
        simulated: true,
        providerResponse: { simulated: true, reason: "No targetWhatsappNumber set on this reminder" },
      };
    }

    if (!this.isConfigured()) {
      logger.info("WhatsApp not configured — no-op (would have sent)", {
        to: payload.targetWhatsappNumber,
        title: payload.title,
      });
      return {
        ok: true,
        simulated: true,
        providerResponse: { simulated: true, reason: "WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID not set" },
      };
    }

    // Real call path — exercised only once credentials exist. Not reachable in this
    // session's tests (no real account), per the honesty rule in TECHNOLOGY_DECISIONS.md.
    const to = payload.targetWhatsappNumber.replace(/^\+/, "");
    const message = env.whatsappTemplateName
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: env.whatsappTemplateName,
            language: { code: env.whatsappTemplateLang },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: payload.title.slice(0, 1000) },
                  { type: "text", text: payload.message.replace(/\s*\n\s*/g, " ").slice(0, 1000) },
                ],
              },
            ],
          },
        }
      : {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: `${payload.title}\n${payload.message}` },
        };
    try {
      const res = await fetch(`${env.whatsappApiUrl}/${env.whatsappPhoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      const body = await res.json();
      if (!res.ok) return { ok: false, error: `WhatsApp API ${res.status}`, providerResponse: body };
      return { ok: true, providerResponse: body };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
