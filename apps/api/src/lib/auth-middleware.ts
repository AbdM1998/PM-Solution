import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../modules/auth/jwt";
import { AppError } from "./error-handler";
import { prisma } from "./prisma";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(AppError.unauthorized("Missing bearer token"));
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired access token"));
  }
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.isAdmin || !user.isActive) return next(AppError.forbidden("Admin access required"));
    next();
  } catch (err) {
    next(err);
  }
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, isActive: true } });
  return !!user?.isAdmin && user.isActive;
}
