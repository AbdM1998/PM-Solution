import { simpleParser } from "mailparser";

export interface ParsedEmail {
  subject: string | null;
  fromAddress: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  messageId: string | null;
  sentAt: Date | null;
  bodyHtml: string | null;
  bodyText: string | null;
  attachments: { fileName: string; mimeType: string; content: Buffer }[];
}

function addressListToStrings(value: unknown): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const entry of list as { value?: { address?: string }[] }[]) {
    for (const v of entry.value ?? []) {
      if (v.address) out.push(v.address);
    }
  }
  return out;
}

export async function parseEml(buffer: Buffer): Promise<ParsedEmail> {
  const parsed = await simpleParser(buffer);
  const from = Array.isArray(parsed.from) ? parsed.from[0] : parsed.from;

  return {
    subject: parsed.subject ?? null,
    fromAddress: from?.value?.[0]?.address ?? null,
    toAddresses: addressListToStrings(parsed.to),
    ccAddresses: addressListToStrings(parsed.cc),
    messageId: parsed.messageId ?? null,
    sentAt: parsed.date ?? null,
    bodyHtml: typeof parsed.html === "string" ? parsed.html : null,
    bodyText: parsed.text ?? null,
    attachments: parsed.attachments.map((a) => ({
      fileName: a.filename ?? "attachment",
      mimeType: a.contentType ?? "application/octet-stream",
      content: a.content,
    })),
  };
}
