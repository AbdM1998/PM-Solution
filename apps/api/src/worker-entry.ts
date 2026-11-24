// Entry point for the worker process (scheduler + dispatcher). Runs as a separate
// Docker container/process from the API so a slow notification provider or a worker
// crash never takes the HTTP API down, per docs/ARCHITECTURE.md.
import http from "http";
import cron from "node-cron";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { runSchedulerTick } from "./worker/scheduler";
import { runDispatcherTick } from "./worker/dispatcher";
import { recordHeartbeat } from "./worker/heartbeat";

let schedulerRunning = false;
let dispatcherRunning = false;

async function schedulerLoop() {
  if (schedulerRunning) return; // never overlap ticks in-process
  schedulerRunning = true;
  try {
    await runSchedulerTick();
    await recordHeartbeat();
  } catch (err) {
    logger.error("Scheduler tick threw", { error: err instanceof Error ? err.message : String(err) });
  } finally {
    schedulerRunning = false;
  }
}

async function dispatcherLoop() {
  if (dispatcherRunning) return;
  dispatcherRunning = true;
  try {
    await runDispatcherTick();
  } catch (err) {
    logger.error("Dispatcher tick threw", { error: err instanceof Error ? err.message : String(err) });
  } finally {
    dispatcherRunning = false;
  }
}

async function main() {
  await prisma.$connect();
  await recordHeartbeat();
  logger.info("Worker starting", {
    tickSeconds: env.workerTickSeconds,
    dispatcherTickSeconds: env.dispatcherTickSeconds,
    batchSize: env.workerBatchSize,
    staleAfterHours: env.staleAfterHours,
  });

  cron.schedule(`*/${env.workerTickSeconds} * * * * *`, schedulerLoop);
  cron.schedule(`*/${env.dispatcherTickSeconds} * * * * *`, dispatcherLoop);

  // Run once immediately on boot rather than waiting for the first cron tick, so a
  // freshly-restarted worker starts catching up on overdue occurrences right away.
  await schedulerLoop();
  await dispatcherLoop();

  // Optional liveness endpoint for hosts that health-check every service over HTTP
  // (Railway). Off unless WORKER_HEALTH_PORT is set — the desktop app and Docker
  // Compose don't need it.
  const healthPort = Number(process.env.WORKER_HEALTH_PORT);
  if (healthPort) {
    http
      .createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", role: "worker" }));
      })
      .listen(healthPort, () => logger.info(`Worker health endpoint on port ${healthPort}`));
  }
}

main().catch((err) => {
  logger.error("Worker failed to start", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

process.on("SIGTERM", async () => {
  logger.info("Worker shutting down");
  await prisma.$disconnect();
  process.exit(0);
});
