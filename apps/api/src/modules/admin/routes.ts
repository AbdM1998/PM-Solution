import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../../lib/auth-middleware";
import { validateBody } from "../../lib/validate";
import { asyncHandler } from "../../lib/error-handler";
import * as adminService from "./service";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    res.json(await adminService.listUsers());
  })
);

const SetAdminInput = z.object({ isAdmin: z.boolean() });

adminRouter.patch(
  "/users/:id",
  validateBody(SetAdminInput),
  asyncHandler(async (req, res) => {
    await adminService.setUserAdmin(req.params.id, req.user!.id, req.body.isAdmin);
    res.status(204).end();
  })
);

adminRouter.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    await adminService.deleteUser(req.params.id, req.user!.id);
    res.status(204).end();
  })
);

adminRouter.get(
  "/integrations",
  asyncHandler(async (_req, res) => {
    res.json(adminService.getIntegrationsStatus());
  })
);
