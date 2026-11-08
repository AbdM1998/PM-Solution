// Claims due ReminderOccurrence rows with `FOR UPDATE SKIP LOCKED` (so two worker
// instances / overlapping ticks never double-process the same occurrence), writes one
// NotificationOutbox row per channel on the reminder, advances recurring reminders to
// their next occurrence, and applies the missed-reminder ("closed for a day") policy.
// See docs/REMINDER_ENGINE.md.
import { randomUUID } from "crypto";
import { Prisma, type ReminderOccurrence } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { env } from "../lib/env";
import { computeNextRecurrence, RECURRING_TYPES } from "../modules/reminders/service";
import { resolveEntityContext } from "../lib/access";
import { hoursBetween } from "../lib/timezone";
import type { OutboxPayload } from "./channels/types";

export const WORKER_ID = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;

/**
 * The atomic claim. Prisma's high-level API has no SKIP LOCKED support, so this uses
 * `$queryRaw` with a tagged `Prisma.sql` template (parameterized, not string
 * concatenation — safe from SQL injection).
 *
 * Deviation from the literal SQL in docs/REMINDER_ENGINE.md: the WHERE clause here
 * also matches status = 'SNOOZED', not only 'PENDING'. The doc's own cancel-on-complete
 * invariant treats PENDING and SNOOZED as equally "still active" occurrences
 * (`status IN (PENDING, SNOOZED)`), and a snoozed occurrence has to be claimable again
 * once its new nextFireAt arrives or snoozing would be a dead end that never re-fires.
 * The doc's SQL block is illustrative of the SKIP LOCKED mechanism, not a literal spec
 * of every status value — this is the one place that was ambiguous enough to need a
 * documented judgment call.
 */
export async function claimDueOccurrences(batchSize = env.workerBatchSize): Promise<ReminderOccurrence[]> {
  return prisma.$queryRaw<ReminderOccurrence[]>(Prisma.sql`
    UPDATE "ReminderOccurrence"
    SET status = 'PROCESSING', "lockedBy" = ${WORKER_ID}, "lockedAt" = now(), "updatedAt" = now()
    WHERE id IN (
      SELECT id FROM "ReminderOccurrence"
      WHERE status IN ('PENDING', 'SNOOZED') AND "nextFireAt" <= now()
      ORDER BY "nextFireAt"
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `);
}

function buildTitleAndMessage(entityTitle: string, projectName: string, wasStale: boolean) {
  const title = wasStale ? `Missed reminder: ${entityTitle}` : `Reminder: ${entityTitle}`;
  const message = wasStale
    ? `While you were away — "${entityTitle}" in ${projectName} was due.`
    : `"${entityTitle}" in ${projectName} is due now.`;
  return { title, message };
}

/**
 * Reclaims occurrences stuck in PROCESSING because a worker died between claiming a
 * row (which commits immediately) and committing the processing transaction below
 * (which is otherwise all-or-nothing, so there's no other partial-state risk). Without
 * this, a hard worker crash mid-tick would leave that occurrence orphaned forever,
 * since the claim query only ever selects PENDING/SNOOZED. Run at the start of every
 * tick so a restart recovers automatically — this is what makes "survives worker
 * restart" true even in the narrow crash window, not just on clean restarts.
 */
export async function reclaimStaleLocks(staleAfterMinutes = 5): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE "ReminderOccurrence"
    SET status = 'PENDING', "lockedBy" = NULL, "lockedAt" = NULL
    WHERE status = 'PROCESSING' AND "lockedAt" < now() - (${staleAfterMinutes}::text || ' minutes')::interval
  `;
  return result;
}

export async function processOneOccurrence(occurrence: ReminderOccurrence, now: Date) {
  const reminder = await prisma.reminder.findUniqueOrThrow({ where: { id: occurrence.reminderId } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: reminder.userId } });

  if (!reminder.isActive) {
    await prisma.reminderOccurrence.update({ where: { id: occurrence.id }, data: { status: "CANCELLED" } });
    return;
  }

  const ctx = await resolveEntityContext(reminder.entityType, reminder.entityId);
  const wasStale = hoursBetween(occurrence.nextFireAt, now) > env.staleAfterHours;
  const { title, message } = buildTitleAndMessage(ctx.title, ctx.projectName, wasStale);

  const payload: OutboxPayload = {
    occurrenceId: occurrence.id,
    reminderId: reminder.id,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    entityType: reminder.entityType,
    entityId: reminder.entityId,
    entityTitle: ctx.title,
    projectId: ctx.projectId,
    projectName: ctx.projectName,
    nextFireAt: occurrence.nextFireAt.toISOString(),
    title,
    message,
    wasStale,
  };

  await prisma.$transaction(async (tx) => {
    // `createMany` + `skipDuplicates` (a single `INSERT ... ON CONFLICT DO NOTHING`)
    // rather than one `create` per channel in a try/catch: a caught unique-constraint
    // error on one statement would otherwise poison the rest of this Postgres
    // transaction (no implicit per-statement savepoint), making every later statement
    // fail with "current transaction is aborted" even though the error was handled in
    // JS. This is what makes the no-double-send guarantee survive reprocessing
    // cleanly instead of only on the first attempt.
    await tx.notificationOutbox.createMany({
      data: reminder.channels.map((channel) => ({
        occurrenceId: occurrence.id,
        channel,
        payload: payload as unknown as Prisma.InputJsonValue,
        idempotencyKey: `${occurrence.id}:${channel}:0`,
      })),
      skipDuplicates: true,
    });

    let nextOccurrenceId: string | null = null;
    if (RECURRING_TYPES.has(reminder.type)) {
      // Guard against creating a second "next occurrence" if this occurrence is ever
      // reprocessed (belt-and-suspenders alongside the outbox idempotency above).
      const alreadyAdvanced = await tx.reminderOccurrence.findFirst({
        where: { reminderId: reminder.id, createdAt: { gt: occurrence.createdAt } },
        select: { id: true },
      });
      if (!alreadyAdvanced) {
        const nextFireAt = computeNextRecurrence(reminder.type, reminder.recurrenceRule, occurrence.nextFireAt, user.timezone);
        const next = await tx.reminderOccurrence.create({
          data: { reminderId: reminder.id, nextFireAt, status: "PENDING" },
        });
        nextOccurrenceId = next.id;
      }
    }

    await tx.reminderOccurrence.update({
      where: { id: occurrence.id },
      data: { status: "SENT", lockedBy: null, lockedAt: null },
    });

    if (nextOccurrenceId) {
      logger.debug("Scheduled next recurrence", { reminderId: reminder.id, nextOccurrenceId });
    }
  });
}

export async function runSchedulerTick(): Promise<{ claimed: number; failed: number }> {
  const now = new Date();
  await reclaimStaleLocks();
  const claimed = await claimDueOccurrences();
  let failed = 0;

  for (const occurrence of claimed) {
    try {
      await processOneOccurrence(occurrence, now);
    } catch (err) {
      failed += 1;
      logger.error("Failed to process occurrence", {
        occurrenceId: occurrence.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Put it back to PENDING so the next tick retries it, rather than leaving it
      // stuck in PROCESSING forever.
      await prisma.reminderOccurrence
        .update({ where: { id: occurrence.id }, data: { status: "PENDING", lockedBy: null, lockedAt: null } })
        .catch(() => undefined);
    }
  }

  if (claimed.length > 0) {
    logger.info("Scheduler tick processed occurrences", { claimed: claimed.length, failed });
  }
  return { claimed: claimed.length, failed };
}
