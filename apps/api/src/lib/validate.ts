import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

// Validates req.body against a Zod schema from @projectflow/shared before any handler
// (and therefore any service/DB call) runs. Rejected requests never touch the database.
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.query = schema.parse(req.query) as unknown as Request["query"];
    next();
  };
}
