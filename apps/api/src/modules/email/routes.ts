import { Router } from "express";
import multer from "multer";
import { CreateEmailThreadInput } from "@projectflow/shared";
import { requireAuth } from "../../lib/auth-middleware";
import { validateBody } from "../../lib/validate";
import { asyncHandler, AppError } from "../../lib/error-handler";
import { MAX_IMPORT_SIZE_BYTES } from "../../lib/file-safety";
import * as emailService from "./service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_SIZE_BYTES },
});

// Mounted at /api/projects/:projectId/email-threads
export const emailThreadsRouterForProject = Router({ mergeParams: true });
emailThreadsRouterForProject.use(requireAuth);

emailThreadsRouterForProject.get(
  "/",
  asyncHandler(async (req, res) => {
    const threads = await emailService.listEmailThreads(req.user!.id, req.params.projectId);
    res.json(threads);
  })
);

emailThreadsRouterForProject.post(
  "/",
  validateBody(CreateEmailThreadInput),
  asyncHandler(async (req, res) => {
    const thread = await emailService.createEmailThread(req.user!.id, req.params.projectId, req.body);
    res.status(201).json(thread);
  })
);

emailThreadsRouterForProject.post(
  "/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest("Missing file upload (field name: file)");
    const result = await emailService.importEmailFile(req.user!.id, req.params.projectId, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer,
    });
    res.status(201).json(result);
  })
);

// Mounted at /api/email-threads
export const emailThreadsRouter = Router();
emailThreadsRouter.use(requireAuth);

emailThreadsRouter.get(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const messages = await emailService.listEmailMessages(req.user!.id, req.params.id);
    res.json(messages);
  })
);

// Mounted at /api/email-connections
export const emailConnectionsRouter = Router();
emailConnectionsRouter.use(requireAuth);

emailConnectionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const connections = await emailService.listEmailConnections(req.user!.id);
    res.json(connections);
  })
);

emailConnectionsRouter.post("/outlook/connect", (req, res, next) => {
  try {
    emailService.connectOutlook();
  } catch (err) {
    next(err);
  }
});

emailConnectionsRouter.post("/gmail/connect", (req, res, next) => {
  try {
    emailService.connectGmail();
  } catch (err) {
    next(err);
  }
});
