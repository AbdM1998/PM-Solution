import { Router } from "express";
import { z } from "zod";
import { CreateTaskInput, UpdateTaskInput } from "@projectflow/shared";
import { requireAuth } from "../../lib/auth-middleware";
import { validateBody } from "../../lib/validate";
import { asyncHandler } from "../../lib/error-handler";
import * as tasksService from "./service";
import { checklistItemsRouterForTask } from "../checklists/routes";

// Mounted at /api/projects/:projectId/tasks (mergeParams so req.params.projectId works).
export const tasksRouterForProject = Router({ mergeParams: true });
tasksRouterForProject.use(requireAuth);

tasksRouterForProject.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await tasksService.listTasks(req.user!.id, req.params.projectId, req.query as Record<string, string>);
    res.json(result);
  })
);

tasksRouterForProject.post(
  "/",
  validateBody(CreateTaskInput),
  asyncHandler(async (req, res) => {
    const task = await tasksService.createTask(req.user!.id, req.params.projectId, req.body);
    res.status(201).json(task);
  })
);

// Mounted at /api/tasks (top-level, entity-addressed routes).
export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const ReorderInput = z.array(z.object({ taskId: z.string(), newIndex: z.number().int().min(0) }));
const BulkCompleteInput = z.object({ taskIds: z.array(z.string()).min(1) });

// GET /api/tasks (no :id) — every task across every project this user can access, for
// the cross-project Board page. Placed before "/:id" so Express doesn't swallow it.
tasksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tasks = await tasksService.listAllTasksForUser(req.user!.id);
    res.json(tasks);
  })
);

tasksRouter.post(
  "/reorder",
  validateBody(ReorderInput),
  asyncHandler(async (req, res) => {
    await tasksService.reorderTasks(req.user!.id, req.body);
    res.status(204).send();
  })
);

tasksRouter.post(
  "/bulk-complete",
  validateBody(BulkCompleteInput),
  asyncHandler(async (req, res) => {
    await tasksService.bulkCompleteTasks(req.user!.id, req.body.taskIds);
    res.status(204).send();
  })
);

tasksRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const task = await tasksService.getTask(req.user!.id, req.params.id);
    res.json(task);
  })
);

tasksRouter.patch(
  "/:id",
  validateBody(UpdateTaskInput),
  asyncHandler(async (req, res) => {
    const task = await tasksService.updateTask(req.user!.id, req.params.id, req.body);
    res.json(task);
  })
);

tasksRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await tasksService.deleteTask(req.user!.id, req.params.id);
    res.status(204).send();
  })
);

tasksRouter.post(
  "/:id/duplicate",
  asyncHandler(async (req, res) => {
    const task = await tasksService.duplicateTask(req.user!.id, req.params.id);
    res.status(201).json(task);
  })
);

tasksRouter.use("/:taskId/checklist-items", checklistItemsRouterForTask);
