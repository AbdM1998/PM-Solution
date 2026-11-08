import { Router } from "express";
import { requireAuth } from "../../lib/auth-middleware";
import { asyncHandler } from "../../lib/error-handler";
import * as dashboardService from "./service";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    res.json(await dashboardService.getDashboardSummary(req.user!.id));
  })
);

dashboardRouter.get(
  "/my-day",
  asyncHandler(async (req, res) => {
    res.json(await dashboardService.getMyDay(req.user!.id));
  })
);
