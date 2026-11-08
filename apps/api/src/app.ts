// Express app wiring only — no `listen()` here (see server.ts), so the app is
// importable and bootable from tests (supertest) without opening a real port.
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env";
import { errorHandler, notFoundHandler } from "./lib/error-handler";
import { authRouter } from "./modules/auth/routes";
import { projectsRouter } from "./modules/projects/routes";
import { tasksRouter } from "./modules/tasks/routes";
import { checklistItemsRouter, checklistTemplatesRouter } from "./modules/checklists/routes";
import { remindersRouter, occurrencesRouter } from "./modules/reminders/routes";
import { notificationsRouter } from "./modules/notifications/routes";
import { devicesRouter, pushSubscriptionsRouter } from "./modules/devices/routes";
import { emailThreadsRouter, emailConnectionsRouter } from "./modules/email/routes";
import { dashboardRouter } from "./modules/dashboard/routes";
import { tagsRouter } from "./modules/tags/routes";
import { healthRouter } from "./modules/health/routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());

  // Explicit allow-list (docs/SECURITY.md), not "*".
  const allowedOrigins = [env.webOrigin, env.mobileOrigin];
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "2mb" }));

  // Generous global limit; /auth/* has its own stricter limiter (see auth/routes.ts).
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Mounted at both paths: docs/API_DESIGN.md's base URL convention implies
  // /api/health (every other documented endpoint is relative to the documented
  // `/api` base), but apps/api/Dockerfile's HEALTHCHECK (owned by the devops/infra
  // engineer) curls the bare `/health` — the conventional path for container/LB
  // health probes that shouldn't need to know about API versioning. Supporting both
  // avoids breaking either contract instead of silently picking one.
  app.use("/health", healthRouter);
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/checklist-items", checklistItemsRouter);
  app.use("/api/checklist-templates", checklistTemplatesRouter);
  app.use("/api/reminders", remindersRouter);
  app.use("/api/occurrences", occurrencesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/devices", devicesRouter);
  app.use("/api/push-subscriptions", pushSubscriptionsRouter);
  app.use("/api/email-threads", emailThreadsRouter);
  app.use("/api/email-connections", emailConnectionsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/tags", tagsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
