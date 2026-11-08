import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { computeNextRecurrence, computeSnoozeFireAt, diffInDays, parseCustomRule } from "./timezone";

describe("computeNextRecurrence — DST safety", () => {
  it("keeps the same local wall-clock time across a spring-forward DST transition (America/New_York)", () => {
    const zone = "America/New_York";
    // 2027-03-14 is the US DST start date (second Sunday of March) — confirm that
    // premise dynamically rather than hardcoding an assumption about the offset.
    const before = DateTime.fromISO("2027-03-13T09:00:00", { zone });
    const after = DateTime.fromISO("2027-03-14T09:00:00", { zone });
    expect(before.offset).not.toBe(after.offset); // sanity check: this really is a DST jump

    const fromUtc = before.toUTC().toJSDate();
    const nextUtc = computeNextRecurrence("DAILY", null, fromUtc, zone);

    // Local wall-clock time must still read 09:00 the next day...
    const nextLocal = DateTime.fromJSDate(nextUtc, { zone: "utc" }).setZone(zone);
    expect(nextLocal.hour).toBe(9);
    expect(nextLocal.minute).toBe(0);
    expect(nextLocal.toISODate()).toBe("2027-03-14");

    // ...even though the UTC instant moved by 23 hours, not 24, because of the DST jump.
    const hoursMoved = (nextUtc.getTime() - fromUtc.getTime()) / (60 * 60 * 1000);
    expect(hoursMoved).toBe(23);
  });

  it("keeps the same local wall-clock time across a fall-back DST transition", () => {
    const zone = "America/New_York";
    // 2027-11-07 is the US DST end date (first Sunday of November).
    const before = DateTime.fromISO("2027-11-06T09:00:00", { zone });
    const after = DateTime.fromISO("2027-11-07T09:00:00", { zone });
    expect(before.offset).not.toBe(after.offset);

    const fromUtc = before.toUTC().toJSDate();
    const nextUtc = computeNextRecurrence("DAILY", null, fromUtc, zone);
    const nextLocal = DateTime.fromJSDate(nextUtc, { zone: "utc" }).setZone(zone);
    expect(nextLocal.hour).toBe(9);

    const hoursMoved = (nextUtc.getTime() - fromUtc.getTime()) / (60 * 60 * 1000);
    expect(hoursMoved).toBe(25);
  });

  it("computes WEEKLY and MONTHLY recurrence by local calendar unit, not fixed millisecond offsets", () => {
    const zone = "UTC";
    const from = new Date("2026-01-31T10:00:00.000Z");
    const monthly = computeNextRecurrence("MONTHLY", null, from, zone);
    expect(DateTime.fromJSDate(monthly, { zone: "utc" }).toISODate()).toBe("2026-02-28"); // luxon clamps short month

    const weekly = computeNextRecurrence("WEEKLY", null, from, zone);
    expect(DateTime.fromJSDate(weekly, { zone: "utc" }).toISODate()).toBe("2026-02-07");
  });

  it("CUSTOM recurrence uses the explicit every:<n>:<unit> rule", () => {
    const from = new Date("2026-06-01T08:00:00.000Z");
    const next = computeNextRecurrence("CUSTOM", "every:3:days", from, "UTC");
    expect(next.toISOString()).toBe("2026-06-04T08:00:00.000Z");
  });

  it("rejects an invalid CUSTOM rule", () => {
    expect(() => parseCustomRule("every:three:days")).toThrow();
    expect(() => parseCustomRule(null)).toThrow();
  });
});

describe("computeSnoozeFireAt", () => {
  const now = new Date("2026-06-15T10:00:00.000Z"); // 13:00 in Asia/Amman (UTC+3)

  it("5m/10m/30m/1h are fixed durations regardless of timezone", () => {
    expect(computeSnoozeFireAt("5m", { timezone: "Asia/Amman", now }).toISOString()).toBe("2026-06-15T10:05:00.000Z");
    expect(computeSnoozeFireAt("1h", { timezone: "Asia/Amman", now }).toISOString()).toBe("2026-06-15T11:00:00.000Z");
  });

  it("later_today resolves to 18:00 local time", () => {
    const result = computeSnoozeFireAt("later_today", { timezone: "Asia/Amman", now });
    const local = DateTime.fromJSDate(result, { zone: "utc" }).setZone("Asia/Amman");
    expect(local.hour).toBe(18);
    expect(local.toISODate()).toBe("2026-06-15");
  });

  it("later_today rolls to tomorrow if already past 18:00 local", () => {
    const lateNow = new Date("2026-06-15T16:00:00.000Z"); // 19:00 in Asia/Amman
    const result = computeSnoozeFireAt("later_today", { timezone: "Asia/Amman", now: lateNow });
    const local = DateTime.fromJSDate(result, { zone: "utc" }).setZone("Asia/Amman");
    expect(local.toISODate()).toBe("2026-06-16");
    expect(local.hour).toBe(18);
  });

  it("tomorrow and next_week preserve local time-of-day", () => {
    const tomorrow = computeSnoozeFireAt("tomorrow", { timezone: "Asia/Amman", now });
    expect(DateTime.fromJSDate(tomorrow, { zone: "utc" }).setZone("Asia/Amman").toISODate()).toBe("2026-06-16");

    const nextWeek = computeSnoozeFireAt("next_week", { timezone: "Asia/Amman", now });
    expect(DateTime.fromJSDate(nextWeek, { zone: "utc" }).setZone("Asia/Amman").toISODate()).toBe("2026-06-22");
  });

  it("custom uses the explicit customAt", () => {
    const customAt = new Date("2030-01-01T00:00:00.000Z");
    expect(computeSnoozeFireAt("custom", { timezone: "UTC", now, customAt })).toEqual(customAt);
  });
});

describe("diffInDays", () => {
  it("counts whole UTC days regardless of time-of-day", () => {
    expect(diffInDays(new Date("2026-01-01T23:00:00Z"), new Date("2026-01-03T01:00:00Z"))).toBe(2);
  });
});
