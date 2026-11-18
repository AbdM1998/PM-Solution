import { Router } from "express";
import multer from "multer";
import { requireAuth, isAdminUser } from "../../lib/auth-middleware";
import { asyncHandler, AppError } from "../../lib/error-handler";
import { MAX_ATTACHMENT_SIZE_BYTES } from "../../lib/file-safety";
import * as attachmentsService from "./service";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES } });

// Mounted at /api/projects/:projectId/attachments
export const attachmentsRouterForProject = Router({ mergeParams: true });
attachmentsRouterForProject.use(requireAuth);

attachmentsRouterForProject.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await attachmentsService.listProjectAttachments(req.user!.id, req.params.projectId));
  })
);

attachmentsRouterForProject.post(
  "/",
  (req, res, next) =>
    upload.single("file")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return next(AppError.badRequest("File is larger than 25MB"));
      }
      next(err);
    }),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest("Missing file upload (field name: file)");
    // multer decodes the multipart filename as latin1; re-decode so Arabic names survive.
    const originalname = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const taskId = typeof req.body?.taskId === "string" && req.body.taskId ? req.body.taskId : undefined;
    const created = await attachmentsService.uploadAttachment(
      req.user!.id,
      req.params.projectId,
      { originalname, size: req.file.size, buffer: req.file.buffer },
      taskId
    );
    res.status(201).json(created);
  })
);

// Mounted at /api/attachments
export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuth);

attachmentsRouter.get(
  "/:id/download",
  asyncHandler(async (req, res) => {
    const isAdmin = await isAdminUser(req.user!.id);
    const file = await attachmentsService.getAttachmentForDownload(req.user!.id, req.params.id, isAdmin);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    );
    res.sendFile(file.fullPath, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: "File is missing from storage", code: "NOT_FOUND" });
    });
  })
);

attachmentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const isAdmin = await isAdminUser(req.user!.id);
    await attachmentsService.deleteAttachment(req.user!.id, req.params.id, isAdmin);
    res.status(204).send();
  })
);
