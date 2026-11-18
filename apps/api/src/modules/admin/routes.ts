import { Router } from "express";
import { z } from "zod";
import { AdminCreateUserInput, AdminTestNotificationInput, AdminUpdateUserInput } from "@projectflow/shared";
import { requireAuth, requireAdmin } from "../../lib/auth-middleware";
import { validateBody } from "../../lib/validate";
import { asyncHandler } from "../../lib/error-handler";
import { prisma } from "../../lib/prisma";
import * as adminService from "./service";
import * as attachmentsService from "../attachments/service";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// ---- Users ----
adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    res.json(await adminService.listUsers());
  })
);

adminRouter.post(
  "/users",
  validateBody(AdminCreateUserInput),
  asyncHandler(async (req, res) => {
    res.status(201).json(await adminService.createUser(req.body));
  })
);

adminRouter.patch(
  "/users/:id",
  validateBody(AdminUpdateUserInput),
  asyncHandler(async (req, res) => {
    await adminService.updateUser(req.params.id, req.user!.id, req.body);
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

// ---- Integrations / notifications ----
adminRouter.get(
  "/integrations",
  asyncHandler(async (_req, res) => {
    res.json(adminService.getIntegrationsStatus());
  })
);

adminRouter.get(
  "/deliveries",
  asyncHandler(async (_req, res) => {
    res.json(await adminService.listDeliveries());
  })
);

adminRouter.post(
  "/test-notification",
  validateBody(AdminTestNotificationInput),
  asyncHandler(async (req, res) => {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json(await adminService.sendTestNotification(req.body.channel, req.body.to, me.name));
  })
);

// ---- Reminders (every user's) ----
adminRouter.get(
  "/reminders",
  asyncHandler(async (_req, res) => {
    res.json(await adminService.listAllReminders());
  })
);

adminRouter.patch(
  "/reminders/:id",
  validateBody(z.object({ isActive: z.boolean() })),
  asyncHandler(async (req, res) => {
    await adminService.setReminderActive(req.params.id, req.body.isActive);
    res.status(204).end();
  })
);

// ---- Files (every project's) ----
adminRouter.get(
  "/attachments",
  asyncHandler(async (_req, res) => {
    res.json(await attachmentsService.listAllAttachments());
  })
);
