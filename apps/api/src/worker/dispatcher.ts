// Processes NotificationOutbox rows: calls the right channel adapter, logs a
// NotificationDelivery row with the result, and retries failed sends with exponential
// backoff (max 5 attempts). One channel/row's failure never blocks another's — each
// outbox row is processed independently in its own try/catch.
import type { NotificationOutbox } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { channelRegistry } from "./channels";

export const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_SECONDS = 10;

export function backoffSecondsFor(attemptNumber: number): number {
  // attemptNumber is 1-indexed (the attempt that just failed). Capped so it never waits
  // more than ~3 minutes between tries in this polling-based design.
  return Math.min(BASE_BACKOFF_SECONDS * 2 ** (attemptNumber - 1), 180);
}

export function isRetryEligible(previousAttempts: number, lastAttemptedAt: Date | null, now: Date): boolean {
  if (previousAttempts === 0) return true;
  if (!lastAttemptedAt) return true;
  const elapsedSeconds = (now.getTime() - lastAttemptedAt.getTime()) / 1000;
  return elapsedSeconds >= backoffSecondsFor(previousAttempts);
}

async function dispatchOne(outbox: NotificationOutbox, now: Date) {
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { outboxId: outbox.id },
    orderBy: { attemptedAt: "desc" },
  });
  const previousAttempts = deliveries.length;
  const lastAttempt = deliveries[0] ?? null;

  if (previousAttempts >= MAX_ATTEMPTS) {
    await prisma.notificationOutbox.update({
      where: { id: outbox.id },
      data: { status: "FAILED", processedAt: now },
    });
    return;
  }

  if (!isRetryEligible(previousAttempts, lastAttempt?.attemptedAt ?? null, now)) {
    return; // still within backoff window for this row; try again next tick
  }

  const adapter = channelRegistry[outbox.channel];
  let result;
  try {
    result = await adapter.send(outbox);
  } catch (err) {
    result = { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }

  if (result.ok) {
    await prisma.$transaction([
      prisma.notificationDelivery.create({
        data: {
          outboxId: outbox.id,
          channel: outbox.channel,
          status: "SENT",
          providerResponse: (result.providerResponse ?? null) as never,
        },
      }),
      prisma.notificationOutbox.update({
        where: { id: outbox.id },
        data: { status: "SENT", processedAt: now },
      }),
    ]);
    return;
  }

  const attemptNumber = previousAttempts + 1;
  const terminal = attemptNumber >= MAX_ATTEMPTS;
  await prisma.$transaction([
    prisma.notificationDelivery.create({
      data: {
        outboxId: outbox.id,
        channel: outbox.channel,
        status: "FAILED",
        error: result.error ?? "Unknown error",
        providerResponse: (result.providerResponse ?? null) as never,
      },
    }),
    prisma.notificationOutbox.update({
      where: { id: outbox.id },
      data: terminal ? { status: "FAILED", processedAt: now } : {},
    }),
  ]);
}

export async function runDispatcherTick(): Promise<{ processed: number }> {
  const now = new Date();
  const pending = await prisma.notificationOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  let processed = 0;
  for (const outbox of pending) {
    try {
      await dispatchOne(outbox, now);
      processed += 1;
    } catch (err) {
      logger.error("Dispatcher failed to process outbox row", {
        outboxId: outbox.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (processed > 0) logger.info("Dispatcher tick processed outbox rows", { processed });
  return { processed };
}
