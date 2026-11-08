import type { Request } from "express";

// Minimal manual cookie reader so we don't need the `cookie-parser` dependency just to
// read the single httpOnly refresh-token cookie we set ourselves with res.cookie()
// (which Express supports natively).
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const parts = header.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}
