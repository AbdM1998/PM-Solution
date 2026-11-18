import { Router } from "express";
import { ApplyStagePresetInput, CreateStageInput, ReorderStagesInput, UpdateStageInput } from "@projectflow/shared";
import { requireAuth } from "../../lib/auth-middleware";
import { validateBody } from "../../lib/validate";
import { asyncHandler } from "../../lib/error-handler";
import * as stagesService from "./service";

// Mounted at /api/projects/:projectId/stages (mergeParams so req.params.projectId works).
export const stagesRouterForProject = Router({ mergeParams: true });
stagesRouterForProject.use(requireAuth);

stagesRouterForProject.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await stagesService.listStages(req.user!.id, req.params.projectId));
  })
);

stagesRouterForProject.post(
  "/",
  validateBody(CreateStageInput),
  asyncHandler(async (req, res) => {
    res.status(201).json(await stagesService.createStage(req.user!.id, req.params.projectId, req.body));
  })
);

// Static paths before "/:stageId" so Express doesn't treat them as ids.
stagesRouterForProject.post(
  "/preset",
  validateBody(ApplyStagePresetInput),
  asyncHandler(async (req, res) => {
    res.status(201).json(await stagesService.applyPreset(req.user!.id, req.params.projectId, req.body.preset));
  })
);

stagesRouterForProject.post(
  "/reorder",
  validateBody(ReorderStagesInput),
  asyncHandler(async (req, res) => {
    res.json(await stagesService.reorderStages(req.user!.id, req.params.projectId, req.body));
  })
);

stagesRouterForProject.post(
  "/advance",
  asyncHandler(async (req, res) => {
    res.json(await stagesService.advanceStage(req.user!.id, req.params.projectId));
  })
);

stagesRouterForProject.patch(
  "/:stageId",
  validateBody(UpdateStageInput),
  asyncHandler(async (req, res) => {
    res.json(await stagesService.updateStage(req.user!.id, req.params.projectId, req.params.stageId, req.body));
  })
);

stagesRouterForProject.delete(
  "/:stageId",
  asyncHandler(async (req, res) => {
    await stagesService.deleteStage(req.user!.id, req.params.projectId, req.params.stageId);
    res.status(204).send();
  })
);
