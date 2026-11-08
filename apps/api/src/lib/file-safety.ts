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
  "text/plain",
  "text/calendar",
]);
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

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
