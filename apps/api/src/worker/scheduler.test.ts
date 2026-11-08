import { describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma";
import { createTestUser, createTestProject, createTestTask } from "../../test/helpers";
import * as remindersService from "../modules/reminders/service";
import { claimDueOccurrences, processOneOccurrence, reclaimStaleLocks, runSchedulerTick } from "./scheduler";

async function makeDueOccurrence(opts: { reminderType?: "ONE_TIME" | "DAILY"; nextFireAt: Date; channels?: ("IN_APP" | "EMAIL")[] }) {
  const { user } = await createTestUser();
  const project = await createTestProject(user.id);
  const task = await createTestTask(project.id, { dueDate: opts.nextFireAt });
  const reminder = await remindersService.createReminder(user.id, {
    entityType: "TASK",
    entityId: task.id,
    type: opts.reminderType ?? "ONE_TIME",
    scheduledAt: opts.nextFireAt.toISOString(),
    channels: opts.channels ?? ["IN_APP"],
  });
  const occurrence = reminder.occurrences[0];
  return { user, project, task, reminder, occurrence };
}

describe("Scheduler — no double send (idempotencyKey)", () => {
  it("the DB rejects two outbox rows with the same idempotencyKey", async () => {
    const { occurrence } = await makeDueOccurrence({ nextFireAt: new Date() });
    const key = `${occurrence.id}:IN_APP:0`;
    await prisma.notificationOutbox.create({
      data: { occurrenceId: occurrence.id, channel: "IN_APP", payload: {}, idempotencyKey: key },
    });
    await expect(
      prisma.notificationOutbox.create({
        data: { occurrenceId: occurrence.id, channel: "IN_APP", payload: {}, idempotencyKey: key },
      })
    ).rejects.toThrow();
  });

  it("processing the same occurrence twice (simulating a crash-and-retry) creates exactly one outbox row per channel", async () => {
    const { occurrence } = await makeDueOccurrence({ nextFireAt: new Date(), channels: ["IN_APP", "EMAIL"] });

    await processOneOccurrence(occurrence, new Date());
    await processOneOccurrence(occurrence, new Date()); // reprocess — must be a no-op for sending

    const outboxRows = await prisma.notificationOutbox.findMany({ where: { occurrenceId: occurrence.id } });
    expect(outboxRows).toHaveLength(2); // one per channel, not four
    expect(new Set(outboxRows.map((r) => r.channel))).toEqual(new Set(["IN_APP", "EMAIL"]));
  });
});

describe("Scheduler — claim query (FOR UPDATE SKIP LOCKED)", () => {
  it("two concurrent claims never return overlapping occurrence ids", async () => {
    const now = new Date();
    const occurrences = await Promise.all(
      Array.from({ length: 10 }, (_, i) => makeDueOccurrence({ nextFireAt: new Date(now.getTime() - i * 1000) }))
    );
    const ids = new Set(occurrences.map((o) => o.occurrence.id));
    expect(ids.size).toBe(10);

    const [batchA, batchB] = await Promise.all([claimDueOccurrences(5), claimDueOccurrences(5)]);

    const idsA = new Set(batchA.map((o) => o.id));
    const idsB = new Set(batchB.map((o) => o.id));
    const overlap = [...idsA].filter((id) => idsB.has(id));
    expect(overlap).toHaveLength(0);
    expect(idsA.size + idsB.size).toBe(10);
  });

  it("claims PENDING and SNOOZED occurrences, never SENT/CANCELLED/PROCESSING ones", async () => {
    const now = new Date();
    const { occurrence: pending } = await makeDueOccurrence({ nextFireAt: now });
    const { occurrence: toSnooze } = await makeDueOccurrence({ nextFireAt: now });
    await prisma.reminderOccurrence.update({ where: { id: toSnooze.id }, data: { status: "SNOOZED", nextFireAt: now } });
    const { occurrence: alreadySent } = await makeDueOccurrence({ nextFireAt: now });
    await prisma.reminderOccurrence.update({ where: { id: alreadySent.id }, data: { status: "SENT" } });
    const { occurrence: cancelled } = await makeDueOccurrence({ nextFireAt: now });
    await prisma.reminderOccurrence.update({ where: { id: cancelled.id }, data: { status: "CANCELLED" } });

    const claimed = await claimDueOccurrences(50);
    const claimedIds = new Set(claimed.map((o) => o.id));

    expect(claimedIds.has(pending.id)).toBe(true);
    expect(claimedIds.has(toSnooze.id)).toBe(true);
    expect(claimedIds.has(alreadySent.id)).toBe(false);
    expect(claimedIds.has(cancelled.id)).toBe(false);
  });
});

describe("Scheduler — missed-reminder recovery policy (closed-for-a-day)", () => {
  it("an occurrence more than STALE_AFTER_HOURS late is sent exactly once, marked wasStale, not dropped and not duplicated", async () => {
    const now = new Date();
    const staleTime = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25h ago > 24h default
    const { occurrence } = await makeDueOccurrence({ nextFireAt: staleTime, channels: ["IN_APP"] });

    await runSchedulerTick();

    const after = await prisma.reminderOccurrence.findUniqueOrThrow({ where: { id: occurrence.id } });
    expect(after.status).toBe("SENT");

    const outboxRows = await prisma.notificationOutbox.findMany({ where: { occurrenceId: occurrence.id } });
    expect(outboxRows).toHaveLength(1); // exactly once — not a flood
    const payload = outboxRows[0].payload as { wasStale: boolean; title: string };
    expect(payload.wasStale).toBe(true);
    expect(payload.title).toMatch(/Missed reminder/);
  });

  it("a day of downtime with many overdue occurrences processes each exactly once in batches, not a flood", async () => {
    const now = new Date();
    const made = await Promise.all(
      Array.from({ length: 8 }, (_, i) => makeDueOccurrence({ nextFireAt: new Date(now.getTime() - (i + 1) * 60 * 60 * 1000) }))
    );

    const { claimed } = await runSchedulerTick();
    expect(claimed).toBe(8);

    for (const { occurrence } of made) {
      const after = await prisma.reminderOccurrence.findUniqueOrThrow({ where: { id: occurrence.id } });
      expect(after.status).toBe("SENT");
      const outboxRows = await prisma.notificationOutbox.findMany({ where: { occurrenceId: occurrence.id } });
      expect(outboxRows).toHaveLength(1); // no duplicate sends across the batch
    }
  });

  it("a non-stale occurrence (just slightly overdue) is NOT flagged wasStale", async () => {
    const now = new Date();
    const { occurrence } = await makeDueOccurrence({ nextFireAt: new Date(now.getTime() - 60 * 1000) });
    await processOneOccurrence(occurrence, now);
    const outbox = await prisma.notificationOutbox.findFirstOrThrow({ where: { occurrenceId: occurrence.id } });
    expect((outbox.payload as { wasStale: boolean }).wasStale).toBe(false);
  });
});

describe("Scheduler — recurring reminders advance to the next occurrence", () => {
  it("a DAILY reminder creates exactly one new PENDING occurrence ~1 day later after firing", async () => {
    const { occurrence, reminder } = await makeDueOccurrence({ nextFireAt: new Date(), reminderType: "DAILY" });

    await processOneOccurrence(occurrence, new Date());

    const all = await prisma.reminderOccurrence.findMany({ where: { reminderId: reminder.id }, orderBy: { createdAt: "asc" } });
    expect(all).toHaveLength(2);
    expect(all[0].status).toBe("SENT");
    expect(all[1].status).toBe("PENDING");
    const deltaHours = (all[1].nextFireAt.getTime() - all[0].nextFireAt.getTime()) / 3_600_000;
    expect(deltaHours).toBeGreaterThan(23);
    expect(deltaHours).toBeLessThan(25);
  });

  it("a ONE_TIME reminder does not create a next occurrence after firing", async () => {
    const { occurrence, reminder } = await makeDueOccurrence({ nextFireAt: new Date() });
    await processOneOccurrence(occurrence, new Date());
    const all = await prisma.reminderOccurrence.findMany({ where: { reminderId: reminder.id } });
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("SENT");
  });
});

describe("Scheduler — stale PROCESSING lock recovery (worker crash mid-tick)", () => {
  it("reclaims an occurrence stuck in PROCESSING past the staleness window back to PENDING", async () => {
    const { occurrence } = await makeDueOccurrence({ nextFireAt: new Date() });
    await prisma.reminderOccurrence.update({
      where: { id: occurrence.id },
      data: { status: "PROCESSING", lockedBy: "dead-worker", lockedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    const reclaimed = await reclaimStaleLocks(5);
    expect(reclaimed).toBeGreaterThanOrEqual(1);

    const after = await prisma.reminderOccurrence.findUniqueOrThrow({ where: { id: occurrence.id } });
    expect(after.status).toBe("PENDING");
    expect(after.lockedBy).toBeNull();
  });

  it("does not reclaim a lock that is still fresh", async () => {
    const { occurrence } = await makeDueOccurrence({ nextFireAt: new Date() });
    await prisma.reminderOccurrence.update({
      where: { id: occurrence.id },
      data: { status: "PROCESSING", lockedBy: "live-worker", lockedAt: new Date() },
    });

    await reclaimStaleLocks(5);

    const after = await prisma.reminderOccurrence.findUniqueOrThrow({ where: { id: occurrence.id } });
    expect(after.status).toBe("PROCESSING");
  });
});
