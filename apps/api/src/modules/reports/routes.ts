import { Router } from "express";
import { requireAuth } from "../../lib/auth-middleware";
import { asyncHandler } from "../../lib/error-handler";
import * as reportsService from "./service";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    res.json(await reportsService.getReportsSummary(req.user!.id));
  })
);
