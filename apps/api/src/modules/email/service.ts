import path from "path";
import sanitizeHtml from "sanitize-html";
import type { CreateEmailThreadInput } from "@projectflow/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import { assertProjectAccess } from "../../lib/access";
import {
  ALLOWED_IMPORT_EXTENSIONS,
  ALLOWED_ATTACHMENT_MIME,
  MAX_IMPORT_SIZE_BYTES,
  hasAllowedExtension,
  writeToStorage,
} from "../../lib/file-safety";
import { parseEml } from "./parsers/eml";
import { parseMsg } from "./parsers/msg";
import { outlookAdapter } from "./providers/outlook";
import { gmailAdapter } from "./providers/gmail";

function toWireThread(thread: { id: string; projectId: string; subject: string; conversationId: string | null; externalUrl: string | null; source: string; notes: string | null; createdAt: Date }) {
  return {
    id: thread.id,
    projectId: thread.projectId,
    subject: thread.subject,
    conversationId: thread.conversationId,
    externalUrl: thread.externalUrl,
    source: thread.source,
    notes: thread.notes,
    createdAt: thread.createdAt.toISOString(),
  };
}

function toWireMessage(message: {
  id: string;
  threadId: string;
  fromAddress: string | null;
  toAddresses: unknown;
  ccAddresses: unknown;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  sentAt: Date | null;
}) {
  return {
    id: message.id,
    threadId: message.threadId,
    fromAddress: message.fromAddress,
    toAddresses: (message.toAddresses as string[] | null) ?? null,
    ccAddresses: (message.ccAddresses as string[] | null) ?? null,
    subject: message.subject,
    bodyHtml: message.bodyHtml,
    bodyText: message.bodyText,
    sentAt: message.sentAt?.toISOString() ?? null,
  };
}

export async function listEmailThreads(userId: string, projectId: string) {
  await assertProjectAccess(userId, projectId);
  const threads = await prisma.emailThread.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  return threads.map(toWireThread);
}

export async function createEmailThread(userId: string, projectId: string, input: CreateEmailThreadInput) {
  await assertProjectAccess(userId, projectId);
  const thread = await prisma.emailThread.create({
    data: {
      projectId,
      subject: input.subject,
      conversationId: input.conversationId,
      externalUrl: input.externalUrl,
      notes: input.notes,
      source: "MANUAL",
    },
  });
  return toWireThread(thread);
}

export async function listEmailMessages(userId: string, threadId: string) {
  const thread = await prisma.emailThread.findUnique({ where: { id: threadId } });
  if (!thread) throw AppError.notFound("Email thread not found");
  await assertProjectAccess(userId, thread.projectId);
  const messages = await prisma.emailMessage.findMany({ where: { threadId }, orderBy: { sentAt: "asc" } });
  return messages.map(toWireMessage);
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "width", "height"],
  },
  // Imported email HTML is never rendered as-is (stored-XSS risk) — strip
  // scripts/handlers/styles beyond the safe defaults.
};

/**
 * POST /projects/:id/email-threads/import — real end-to-end .eml/.msg import: parse,
 * sanitize HTML body, store attachments on disk (metadata only in the DB), create an
 * EmailThread (source=IMPORTED_FILE) + EmailMessage + Attachment rows.
 */
export async function importEmailFile(
  userId: string,
  projectId: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer }
) {
  await assertProjectAccess(userId, projectId);

  if (!hasAllowedExtension(file.originalname, ALLOWED_IMPORT_EXTENSIONS)) {
    throw AppError.badRequest("Only .eml and .msg files are accepted");
  }
  if (file.size > MAX_IMPORT_SIZE_BYTES) {
    throw AppError.badRequest(`File exceeds the ${MAX_IMPORT_SIZE_BYTES / (1024 * 1024)}MB import limit`);
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const parsed = ext === ".msg" ? parseMsg(file.buffer) : await parseEml(file.buffer);

  const safeHtml = parsed.bodyHtml ? sanitizeHtml(parsed.bodyHtml, SANITIZE_OPTIONS) : null;

  return prisma.$transaction(async (tx) => {
    const thread = await tx.emailThread.create({
      data: {
        projectId,
        subject: parsed.subject ?? file.originalname,
        source: "IMPORTED_FILE",
        conversationId: parsed.messageId,
      },
    });

    const message = await tx.emailMessage.create({
      data: {
        threadId: thread.id,
        messageId: parsed.messageId,
        fromAddress: parsed.fromAddress,
        toAddresses: parsed.toAddresses,
        ccAddresses: parsed.ccAddresses,
        subject: parsed.subject,
        bodyHtml: safeHtml,
        bodyText: parsed.bodyText,
        sentAt: parsed.sentAt,
      },
    });

    for (const attachment of parsed.attachments) {
      if (!ALLOWED_ATTACHMENT_MIME.has(attachment.mimeType)) {
        // Skip disallowed attachment types rather than failing the whole import — the
        // email body/metadata is still valuable even if one attachment type is rejected.
        continue;
      }
      const storagePath = await writeToStorage("email-attachments", attachment.fileName, attachment.content);
      await tx.attachment.create({
        data: {
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.content.length,
          storagePath,
          emailMessageId: message.id,
        },
      });
    }

    return { thread: toWireThread(thread), message: toWireMessage(message) };
  });
}

export async function listEmailConnections(userId: string) {
  const connections = await prisma.emailConnection.findMany({ where: { userId } });
  return connections.map((c) => ({
    id: c.id,
    provider: c.provider,
    accountEmail: c.accountEmail,
    status: c.status,
    connectedAt: c.connectedAt?.toISOString() ?? null,
  }));
}

export function connectOutlook(): never {
  throw AppError.notImplemented(
    "Outlook connection requires a registered Azure AD app. Set MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET and MS_GRAPH_TENANT_ID in .env to enable this.",
    { requiredEnvVars: outlookAdapter.requiredEnvVars() }
  );
}

export function connectGmail(): never {
  throw AppError.notImplemented(
    "Gmail connection requires a registered Google Cloud OAuth client. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI in .env to enable this.",
    { requiredEnvVars: gmailAdapter.requiredEnvVars() }
  );
}
