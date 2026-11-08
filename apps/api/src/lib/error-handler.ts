import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "./logger";

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, "BAD_REQUEST", message, details);
  }
  static unauthorized(message = "Unauthorized") {
    return new AppError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "Forbidden") {
    return new AppError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new AppError(404, "NOT_FOUND", message);
  }
  static conflict(message: string) {
    return new AppError(409, "CONFLICT", message);
  }
  static notImplemented(message: string, details?: unknown) {
    return new AppError(501, "NOT_IMPLEMENTED", message, details);
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: "Not found", code: "NOT_FOUND" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      const errorId = randomUUID();
      logger.error("Internal error", { errorId, message: err.message, stack: err.stack });
      return res.status(err.status).json({ message: "Internal server error", code: err.code, errorId });
    }
    return res.status(err.status).json({ message: err.message, code: err.code, details: err.details });
  }

  const errorId = randomUUID();
  const e = err as Error;
  logger.error("Unhandled error", { errorId, message: e?.message, stack: e?.stack });
  res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR", errorId });
}

// Wraps an async route handler so a rejected promise reaches errorHandler instead of
// crashing the process / hanging the request.
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
