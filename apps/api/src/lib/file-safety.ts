import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { env } from "./env";

// docs/SECURITY.md: MIME/extension allow-list, size cap, stored outside any
// web-servable path, filename never trusted for the on-disk path.
export const ALLOWED_IMPORT_EXTENSIONS = new Set([".eml", ".msg"]);
export const MAX_IMPORT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export const ALLOWED_ATTACHMENT_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
  "text/calendar",
]);
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

// Browsers often report office/zip files as application/octet-stream, so user uploads
// are allowed by EXTENSION; the stored MIME type is then derived from the extension
// (never trusted from the client) so downloads are served with a known-safe type.
export const ATTACHMENT_EXTENSION_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".zip": "application/zip",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".ics": "text/calendar",
};

export function resolveStoragePath(storagePath: string): string {
  const root = path.resolve(env.storageRoot);
  const full = path.resolve(root, storagePath);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage path");
  return full;
}

export async function deleteFromStorage(storagePath: string) {
  try {
    await fs.unlink(resolveStoragePath(storagePath));
  } catch {
    // already gone — the DB row is the source of truth
  }
}

/** Writes a buffer under STORAGE_ROOT with a random filename (original name is never
 * trusted as a path — kept only as Attachment.fileName metadata). Returns the relative
 * storagePath persisted in the DB. */
export async function writeToStorage(subdir: string, originalName: string, content: Buffer): Promise<string> {
  const ext = path.extname(originalName).slice(0, 10); // bounded, cosmetic only
  const safeName = `${randomUUID()}${ext}`;
  const dir = path.join(env.storageRoot, subdir);
  await fs.mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, safeName);
  await fs.writeFile(fullPath, content);
  return path.join(subdir, safeName);
}

export function hasAllowedExtension(fileName: string, allowed: Set<string>): boolean {
  return allowed.has(path.extname(fileName).toLowerCase());
}
