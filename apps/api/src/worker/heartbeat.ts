import { prisma } from "../lib/prisma";

const HEARTBEAT_ID = 1;

/** Upserts the single heartbeat row every worker tick. Read by `GET /health` (a
 * separate process) to decide whether the worker is still alive. */
export async function recordHeartbeat(): Promise<void> {
  await prisma.workerHeartbeat.upsert({
    where: { id: HEARTBEAT_ID },
    update: { lastTickAt: new Date() },
    create: { id: HEARTBEAT_ID, lastTickAt: new Date() },
  });
}

export async function getHeartbeatAgeSeconds(): Promise<number | null> {
  const row = await prisma.workerHeartbeat.findUnique({ where: { id: HEARTBEAT_ID } });
  if (!row) return null;
  return (Date.now() - row.lastTickAt.getTime()) / 1000;
}
