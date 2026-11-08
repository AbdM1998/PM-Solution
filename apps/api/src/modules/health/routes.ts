import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getHeartbeatAgeSeconds } from "../../worker/heartbeat";
import { env } from "../../lib/env";

export const healthRouter = Router();

// Worker is considered healthy if it ticked within 3x its configured tick interval —
// generous enough to not flap on a single slow tick, tight enough to catch a dead
// worker process within a couple of minutes.
function workerHealthyThresholdSeconds() {
  return env.workerTickSeconds * 3;
}

async function checkDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

healthRouter.get("/", async (_req, res) => {
  const dbOk = await checkDb();
  const heartbeatAgeSeconds = await getHeartbeatAgeSeconds().catch(() => null);
  const workerHealthy = heartbeatAgeSeconds !== null && heartbeatAgeSeconds <= workerHealthyThresholdSeconds();

  res.json({
    status: dbOk && workerHealthy ? "ok" : "degraded",
    db: dbOk,
    worker: { healthy: workerHealthy, heartbeatAgeSeconds },
  });
});

healthRouter.get("/ready", async (_req, res) => {
  const dbOk = await checkDb();
  const heartbeatAgeSeconds = await getHeartbeatAgeSeconds().catch(() => null);
  const workerHealthy = heartbeatAgeSeconds !== null && heartbeatAgeSeconds <= workerHealthyThresholdSeconds();

  if (dbOk && workerHealthy) {
    return res.json({ ready: true });
  }
  res.status(503).json({ ready: false, db: dbOk, worker: { healthy: workerHealthy, heartbeatAgeSeconds } });
});
