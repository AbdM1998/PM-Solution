import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../lib/auth-middleware";
import { validateBody } from "../../lib/validate";
import { asyncHandler } from "../../lib/error-handler";
import { prisma } from "../../lib/prisma";

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

const RegisterDeviceInput = z.object({
  platform: z.enum(["ANDROID", "IOS", "WEB"]),
  token: z.string().min(1),
});

devicesRouter.post(
  "/register",
  validateBody(RegisterDeviceInput),
  asyncHandler(async (req, res) => {
    const device = await prisma.deviceToken.upsert({
      where: { token: req.body.token },
      update: { userId: req.user!.id, platform: req.body.platform, lastSeenAt: new Date() },
      create: { userId: req.user!.id, platform: req.body.platform, token: req.body.token },
    });
    res.status(201).json({ id: device.id, platform: device.platform });
  })
);

export const pushSubscriptionsRouter = Router();
pushSubscriptionsRouter.use(requireAuth);

const PushSubscriptionInput = z.object({
  endpoint: z.string().url(),
  keys: z.record(z.string()),
});

pushSubscriptionsRouter.post(
  "/",
  validateBody(PushSubscriptionInput),
  asyncHandler(async (req, res) => {
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint: req.body.endpoint },
      update: { userId: req.user!.id, keys: req.body.keys },
      create: { userId: req.user!.id, endpoint: req.body.endpoint, keys: req.body.keys },
    });
    res.status(201).json({ id: sub.id });
  })
);
