import type { NotificationOutbox, ReminderChannel } from "@prisma/client";

export interface ChannelSendResult {
  ok: boolean;
  /** true when no real send was attempted because credentials aren't configured — the
   * outbox row still resolves (status SENT) but the log transparently records this was
   * not a real delivery, instead of throwing or silently pretending to succeed. */
  simulated?: boolean;
  providerResponse?: unknown;
  error?: string;
}

export interface ChannelAdapter {
  channel: ReminderChannel;
  isConfigured(): boolean;
  send(outbox: NotificationOutbox): Promise<ChannelSendResult>;
}

/** Shape stored in NotificationOutbox.payload (Json) — written once by the scheduler,
 * read by every channel adapter. Denormalized so a channel never has to re-query the
 * entity/project/user at send time. */
export interface OutboxPayload {
  occurrenceId: string;
  reminderId: string;
  userId: string;
  userEmail: string;
  userName: string;
  /** EMAIL delivery target: the reminder's own override, or the account's email when
   * none was set. Always non-empty — see scheduler.ts's payload construction. */
  targetEmail: string;
  /** WHATSAPP delivery target. Null when the reminder has no override set — there is
   * no account-level phone number to fall back to, so a WHATSAPP channel with no
   * target is reported as simulated/no-op even when credentials are configured. */
  targetWhatsappNumber: string | null;
  entityType: "PROJECT" | "TASK" | "CHECKLIST_ITEM";
  entityId: string;
  entityTitle: string;
  projectId: string;
  projectName: string;
  nextFireAt: string; // ISO
  title: string;
  message: string;
  /** true when this occurrence was more than STALE_AFTER_HOURS late when the worker
   * finally processed it — rendered as a "while you were away" digest instead of a
   * normal just-fired notification (missed-reminder recovery policy). */
  wasStale: boolean;
}
