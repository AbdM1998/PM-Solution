import nodemailer, { type Transporter } from "nodemailer";
import type { NotificationOutbox } from "@prisma/client";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { ChannelAdapter, ChannelSendResult, OutboxPayload } from "./types";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
  }
  return transporter;
}

// SMTP via nodemailer. If SMTP_HOST is empty, this adapter never attempts a real send —
// it logs the would-be email (recipient/subject/body) as a simulated delivery instead,
// so NotificationDelivery always has an honest record (`providerResponse.simulated`)
// rather than crashing or claiming a real send happened.
export const emailChannel: ChannelAdapter = {
  channel: "EMAIL",
  isConfigured() {
    return env.smtpHost.length > 0;
  },
  async send(outbox: NotificationOutbox): Promise<ChannelSendResult> {
    const payload = outbox.payload as unknown as OutboxPayload;
    const subject = payload.wasStale ? `[While you were away] ${payload.title}` : payload.title;
    const text = payload.message;

    if (!this.isConfigured()) {
      logger.info("SMTP not configured — logging email instead of sending", {
        to: payload.userEmail,
        subject,
      });
      return {
        ok: true,
        simulated: true,
        providerResponse: { simulated: true, to: payload.userEmail, subject, bodyPreview: text.slice(0, 200) },
      };
    }

    try {
      const info = await getTransporter().sendMail({
        from: env.smtpFrom,
        to: payload.userEmail,
        subject,
        text,
      });
      return { ok: true, providerResponse: { messageId: info.messageId } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
