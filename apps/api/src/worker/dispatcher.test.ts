import { describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { createTestUser, createTestProject, createTestTask } from "../../test/helpers";
import * as remindersService from "../modules/reminders/service";
import { processOneOccurrence } from "./scheduler";
import { runDispatcherTick, backoffSecondsFor, isRetryEligible, MAX_ATTEMPTS } from "./dispatcher";
import { channelRegistry } from "./channels";

async function makeOutboxRow(channel: "IN_APP" | "EMAIL" | "WHATSAPP" | "PUSH" | "BROWSER_PUSH" = "IN_APP") {
  const { user } = await createTestUser();
  const project = await createTestProject(user.id);
  const task = await createTestTask(project.id, { dueDate: new Date() });
  const reminder = await remindersService.createReminder(user.id, {
    entityType: "TASK",
    entityId: task.id,
    type: "ONE_TIME",
    scheduledAt: new Date().toISOString(),
    channels: [channel],
  });
  const occurrence = reminder.occurrences[0];
  await processOneOccurrence(occurrence, new Date());
  const outbox = await prisma.notificationOutbox.findFirstOrThrow({ where: { occurrenceId: occurrence.id, channel } });
  return { user, outbox };
}

describe("backoff math (pure functions)", () => {
  it("doubles each attempt, capped at 180s", () => {
    expect(backoffSecondsFor(1)).toBe(10);
    expect(backoffSecondsFor(2)).toBe(20);
    expect(backoffSecondsFor(3)).toBe(40);
    expect(backoffSecondsFor(4)).toBe(80);
    expect(backoffSecondsFor(5)).toBe(160);
    expect(backoffSecondsFor(6)).toBe(180); // capped
  });

  it("is eligible immediately on the first attempt", () => {
    expect(isRetryEligible(0, null, new Date())).toBe(true);
  });

  it("is not eligible before the backoff window elapses, and is at/after the threshold", () => {
    const lastAttempt = new Date("2026-01-01T00:00:00.000Z"); // attempt 1 failed; backoff(1) = 10s
    expect(isRetryEligible(1, lastAttempt, new Date("2026-01-01T00:00:09.000Z"))).toBe(false);
    expect(isRetryEligible(1, lastAttempt, new Date("2026-01-01T00:00:10.000Z"))).toBe(true);
    expect(isRetryEligible(1, lastAttempt, new Date("2026-01-01T00:00:11.000Z"))).toBe(true);
  });
});

describe("Dispatcher — channel adapters no-op cleanly without credentials (never throw, never fake success silently)", () => {
  for (const channel of ["EMAIL", "WHATSAPP", "PUSH", "BROWSER_PUSH"] as const) {
    it(`${channel}: resolves as a transparently-marked simulated delivery when unconfigured`, async () => {
      expect(channelRegistry[channel].isConfigured()).toBe(false); // test env has no creds for any of these

      const { outbox } = await makeOutboxRow(channel);
      await runDispatcherTick();

      const after = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: outbox.id } });
      expect(after.status).toBe("SENT");

      const deliveries = await prisma.notificationDelivery.findMany({ where: { outboxId: outbox.id } });
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].status).toBe("SENT");
      expect((deliveries[0].providerResponse as { simulated: boolean }).simulated).toBe(true);
    });
  }

  it("IN_APP (fully live, no credentials needed) delivers without simulation", async () => {
    const { outbox } = await makeOutboxRow("IN_APP");
    await runDispatcherTick();
    const deliveries = await prisma.notificationDelivery.findMany({ where: { outboxId: outbox.id } });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("SENT");
  });
});

describe("Dispatcher — retry with exponential backoff, max attempts, one channel's failure never blocks another's row", () => {
  it("retries a failing channel up to MAX_ATTEMPTS then marks it FAILED, while a healthy row in the same tick still succeeds", async () => {
    const sendSpy = vi.spyOn(channelRegistry.WHATSAPP, "send").mockResolvedValue({ ok: false, error: "simulated provider outage" });

    const { outbox: failingOutbox } = await makeOutboxRow("WHATSAPP");
    const { outbox: healthyOutbox } = await makeOutboxRow("IN_APP");

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await runDispatcherTick();
      // Bypass real-time backoff waiting in the test by backdating the last attempt.
      await prisma.notificationDelivery.updateMany({
        where: { outboxId: failingOutbox.id },
        data: { attemptedAt: new Date(Date.now() - 10 * 60 * 1000) },
      });
    }

    const finalOutbox = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: failingOutbox.id } });
    expect(finalOutbox.status).toBe("FAILED");
    const deliveries = await prisma.notificationDelivery.findMany({ where: { outboxId: failingOutbox.id } });
    expect(deliveries).toHaveLength(MAX_ATTEMPTS);
    expect(deliveries.every((d) => d.status === "FAILED")).toBe(true);

    const healthyAfter = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: healthyOutbox.id } });
    expect(healthyAfter.status).toBe("SENT"); // unaffected by WhatsApp's failures

    sendSpy.mockRestore();
  });
});
