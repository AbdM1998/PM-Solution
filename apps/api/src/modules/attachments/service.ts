// Project/task files. Stored under STORAGE_ROOT with a random on-disk name (see
// lib/file-safety.ts); the original filename is metadata only.
import path from "path";
import type { Attachment, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import { assertProjectAccess } from "../../lib/access";
import {
  ATTACHMENT_EXTENSION_MIME,
  MAX_ATTACHMENT_SIZE_BYTES,
  deleteFromStorage,
  resolveStoragePath,
  writeToStorage,
} from "../../lib/file-safety";

export interface UploadedFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

type AttachmentWithContext = Prisma.AttachmentGetPayload<{
  include: { project: { select: { name: true } }; task: { select: { title: true } } };
}>;

async function toWire(rows: AttachmentWithContext[]) {
  const uploaderIds = [...new Set(rows.map((r) => r.uploadedById).filter((x): x is string => !!x))];
  const users = uploaderIds.length
    ? await prisma.user.findMany({ where: { id: { in: uploaderIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    projectId: a.projectId,
    projectName: a.project?.name ?? null,
    taskId: a.taskId,
    taskTitle: a.task?.title ?? null,
    uploadedById: a.uploadedById,
    uploadedByName: a.uploadedById ? nameById.get(a.uploadedById) ?? null : null,
    createdAt: a.createdAt.toISOString(),
  }));
}

const withContext = { project: { select: { name: true } }, task: { select: { title: true } } } as const;

export async function listProjectAttachments(userId: string, projectId: string) {
  await assertProjectAccess(userId, projectId);
  const rows = await prisma.attachment.findMany({
    where: { projectId, emailMessageId: null },
    include: withContext,
    orderBy: { createdAt: "desc" },
  });
  return toWire(rows);
}

export async function listAllAttachments() {
  const rows = await prisma.attachment.findMany({
    where: { emailMessageId: null },
    include: withContext,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return toWire(rows);
}

export async function uploadAttachment(userId: string, projectId: string, file: UploadedFile, taskId?: string) {
  await assertProjectAccess(userId, projectId);
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = ATTACHMENT_EXTENSION_MIME[ext];
  if (!mimeType) {
    throw AppError.badRequest(
      `File type not allowed. Allowed: ${Object.keys(ATTACHMENT_EXTENSION_MIME).join(", ")}`
    );
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) throw AppError.badRequest("File is larger than 25MB");
  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.projectId !== projectId) throw AppError.badRequest("taskId must belong to this project");
  }

  const fileName = path.basename(file.originalname).slice(0, 255);
  const storagePath = await writeToStorage(path.join("attachments", projectId), fileName, file.buffer);
  const row = await prisma.attachment.create({
    data: { fileName, mimeType, sizeBytes: file.size, storagePath, projectId, taskId: taskId ?? null, uploadedById: userId },
    include: withContext,
  });
  await prisma.activityLog.create({
    data: { projectId, taskId: taskId ?? null, userId, action: "file.uploaded", metadata: { fileName } },
  });
  return (await toWire([row]))[0];
}

async function getAccessibleAttachment(userId: string, attachmentId: string, isAdmin: boolean): Promise<Attachment> {
  const a = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!a) throw AppError.notFound("File not found");
  if (!isAdmin) {
    if (!a.projectId) throw AppError.forbidden("You do not have access to this file");
    await assertProjectAccess(userId, a.projectId);
  }
  return a;
}

export async function getAttachmentForDownload(userId: string, attachmentId: string, isAdmin: boolean) {
  const a = await getAccessibleAttachment(userId, attachmentId, isAdmin);
  return { fullPath: resolveStoragePath(a.storagePath), fileName: a.fileName, mimeType: a.mimeType };
}

export async function deleteAttachment(userId: string, attachmentId: string, isAdmin: boolean) {
  const a = await getAccessibleAttachment(userId, attachmentId, isAdmin);
  await prisma.attachment.delete({ where: { id: a.id } });
  await deleteFromStorage(a.storagePath);
  if (a.projectId) {
    await prisma.activityLog.create({
      data: { projectId: a.projectId, userId, action: "file.deleted", metadata: { fileName: a.fileName } },
    });
  }
}
