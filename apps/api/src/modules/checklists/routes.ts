import { Router } from "express";
import { z } from "zod";
import { CreateChecklistItemInput, UpdateChecklistItemInput, CreateChecklistTemplateInput } from "@projectflow/shared";
import { requireAuth } from "../../lib/auth-middleware";
import { validateBody } from "../../lib/validate";
import { asyncHandler } from "../../lib/error-handler";
import * as checklistsService from "./service";

// Mounted at /api/tasks/:taskId/checklist-items
export const checklistItemsRouterForTask = Router({ mergeParams: true });
checklistItemsRouterForTask.use(requireAuth);

checklistItemsRouterForTask.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await checklistsService.listChecklistItems(req.user!.id, req.params.taskId);
    res.json(items);
  })
);

checklistItemsRouterForTask.post(
  "/",
  validateBody(CreateChecklistItemInput),
  asyncHandler(async (req, res) => {
    const item = await checklistsService.createChecklistItem(req.user!.id, req.params.taskId, req.body);
    res.status(201).json(item);
  })
);

// Mounted at /api/checklist-items
export const checklistItemsRouter = Router();
checklistItemsRouter.use(requireAuth);

// Field names (`id`/`newIndex`, `ids`) match packages/shared/src/api-client.ts's
// reorderChecklistItems/bulkCompleteChecklistItems exactly (apps/web additions).
const ReorderInput = z.array(z.object({ id: z.string(), newIndex: z.number().int().min(0) }));
const BulkCompleteInput = z.object({ ids: z.array(z.string()).min(1) });

checklistItemsRouter.post(
  "/reorder",
  validateBody(ReorderInput),
  asyncHandler(async (req, res) => {
    await checklistsService.reorderChecklistItems(
      req.user!.id,
      req.body.map((r: { id: string; newIndex: number }) => ({ itemId: r.id, newIndex: r.newIndex }))
    );
    res.status(204).send();
  })
);

checklistItemsRouter.post(
  "/bulk-complete",
  validateBody(BulkCompleteInput),
  asyncHandler(async (req, res) => {
    await checklistsService.bulkCompleteChecklistItems(req.user!.id, req.body.ids);
    res.status(204).send();
  })
);

checklistItemsRouter.patch(
  "/:id",
  validateBody(UpdateChecklistItemInput),
  asyncHandler(async (req, res) => {
    const item = await checklistsService.updateChecklistItem(req.user!.id, req.params.id, req.body);
    res.json(item);
  })
);

checklistItemsRouter.post(
  "/:id/complete",
  asyncHandler(async (req, res) => {
    const item = await checklistsService.completeChecklistItem(req.user!.id, req.params.id);
    res.json(item);
  })
);

checklistItemsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await checklistsService.deleteChecklistItem(req.user!.id, req.params.id);
    res.status(204).send();
  })
);

// Mounted at /api/checklist-templates
export const checklistTemplatesRouter = Router();
checklistTemplatesRouter.use(requireAuth);

checklistTemplatesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const templates = await checklistsService.listChecklistTemplates(req.user!.id);
    res.json(templates);
  })
);

checklistTemplatesRouter.post(
  "/",
  validateBody(CreateChecklistTemplateInput),
  asyncHandler(async (req, res) => {
    const template = await checklistsService.createChecklistTemplate(req.user!.id, req.body);
    res.status(201).json(template);
  })
);

const ApplyTemplateInput = z.object({ taskId: z.string() });
checklistTemplatesRouter.post(
  "/:id/apply",
  validateBody(ApplyTemplateInput),
  asyncHandler(async (req, res) => {
    const items = await checklistsService.applyChecklistTemplate(req.user!.id, req.params.id, req.body.taskId);
    res.status(201).json(items);
  })
);
