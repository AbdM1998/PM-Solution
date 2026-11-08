// @kenjiuno/msgreader parses Outlook .msg (binary MAPI) files. Field names below are
// verified against node_modules/@kenjiuno/msgreader/lib/{MsgReader,Defs}.d.ts (the
// installed package's own type declarations), not guessed.
import MsgReader from "@kenjiuno/msgreader";
import type { ParsedEmail } from "./eml";

export function parseMsg(buffer: Buffer): ParsedEmail {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const reader = new MsgReader(view);
  const data = reader.getFileData();
  if (data.error) {
    throw new Error(`Failed to parse .msg file: ${data.error}`);
  }

  const recipients = data.recipients ?? [];
  const toAddresses = recipients
    .filter((r) => (r.recipType ?? "to") === "to")
    .map((r) => r.smtpAddress ?? r.email ?? "")
    .filter(Boolean);
  const ccAddresses = recipients
    .filter((r) => r.recipType === "cc")
    .map((r) => r.smtpAddress ?? r.email ?? "")
    .filter(Boolean);

  const attachments = (data.attachments ?? [])
    .filter((a) => !a.innerMsgContent) // skip embedded .msg-in-.msg attachments (out of scope)
    .map((a, i) => {
      const content = reader.getAttachment(a);
      return {
        fileName: a.fileName ?? a.fileNameShort ?? `attachment-${i}`,
        mimeType: a.attachMimeTag ?? "application/octet-stream",
        content: Buffer.from(content.content),
      };
    });

  return {
    subject: data.subject ?? null,
    fromAddress: data.senderSmtpAddress ?? data.senderEmail ?? null,
    toAddresses,
    ccAddresses,
    messageId: data.messageId ?? null,
    sentAt: data.messageDeliveryTime ? new Date(data.messageDeliveryTime) : data.creationTime ? new Date(data.creationTime) : null,
    bodyHtml: data.bodyHtml ?? null,
    bodyText: data.body ?? null,
    attachments,
  };
}
