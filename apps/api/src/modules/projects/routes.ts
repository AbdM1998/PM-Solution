import { Router } from "express";
import { CreateProjectInput, UpdateProjectInput } from "@projectflow/shared";
import { requireAuth } from "../../lib/auth-middleware";
import { validateBody } from "../../lib/validate";
import { asyncHandler } from "../../lib/error-handler";
import * as projectsService from "./service";
import { tasksRouterForProject } from "../tasks/routes";
import { emailThreadsRouterForProject } from "../email/routes";
import { stagesRouterForProject } from "../stages/routes";
import { attachmentsRouterForProject } from "../attachments/routes";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await projectsService.listProjects(req.user!.id, req.query as Record<string, string>);
    res.json(result);
  })
);

projectsRouter.post(
  "/",
  validateBody(CreateProjectInput),
  asyncHandler(async (req, res) => {
    const project = await projectsService.createProject(req.user!.id, req.body);
    res.status(201).json(project);
  })
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const project = await projectsService.getProject(req.user!.id, req.params.id);
    res.json(project);
  })
);

projectsRouter.patch(
  "/:id",
  validateBody(UpdateProjectInput),
  asyncHandler(async (req, res) => {
    const project = await projectsService.updateProject(req.user!.id, req.params.id, req.body);
    res.json(project);
  })
);

projectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await projectsService.deleteProject(req.user!.id, req.params.id, req.query.force === "true");
    res.status(204).send();
  })
);

projectsRouter.get(
  "/:id/activity",
  asyncHandler(async (req, res) => {
    const activity = await projectsService.getProjectActivity(req.user!.id, req.params.id);
    res.json(activity);
  })
);

projectsRouter.use("/:projectId/tasks", tasksRouterForProject);
projectsRouter.use("/:projectId/email-threads", emailThreadsRouterForProject);
projectsRouter.use("/:projectId/stages", stagesRouterForProject);
projectsRouter.use("/:projectId/attachments", attachmentsRouterForProject);
