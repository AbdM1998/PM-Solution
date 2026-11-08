import { Router } from "express";
import { requireAuth } from "../../lib/auth-middleware";
import { asyncHandler } from "../../lib/error-handler";
import * as notificationsService from "./service";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const unread = req.query.unread === "true";
    const notifications = await notificationsService.listNotifications(req.user!.id, unread);
    res.json(notifications);
  })
);

notificationsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await notificationsService.markRead(req.user!.id, req.params.id);
    res.status(204).send();
  })
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await notificationsService.markAllRead(req.user!.id);
    res.status(204).send();
  })
);
