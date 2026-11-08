// All reminder-scheduling math goes through luxon and is timezone-aware. We never do
// manual UTC offset arithmetic (e.g. `date.setHours(date.getHours() + 24)`), which is
// exactly what breaks across DST transitions. `nextFireAt` is always stored/returned as
// a plain UTC `Date` (Postgres `timestamptz`); the user's IANA `timezone` is only used
// here, at the point we compute what "9am" or "every Monday" or "tomorrow" means.
import { DateTime } from "luxon";
import type { ReminderType, SnoozeOption } from "@projectflow/shared";

const DEFAULT_ZONE_FALLBACK = "UTC";

function safeZone(timezone: string | null | undefined): string {
  return timezone && DateTime.local().setZone(timezone).isValid ? timezone : DEFAULT_ZONE_FALLBACK;
}

/**
 * Minimal, explicit recurrence grammar used for `Reminder.recurrenceRule` (CUSTOM type
 * only — DAILY/WEEKLY/MONTHLY need no rule, the type itself is the interval).
 * Format: "every:<positiveInteger>:<unit>" where unit is one of
 * minutes|hours|days|weeks|months. e.g. "every:3:days".
 *
 * This is a deliberate simplification of full RFC 5545 RRULE syntax — no RRULE parsing
 * library was in the approved dependency list for this project, and the brief's
 * requirement is "recurring reminders compute correct next occurrence", not RFC 5545
 * compliance. Documented as a deviation in the final delivery report.
 */
export interface CustomRule {
  interval: number;
  unit: "minutes" | "hours" | "days" | "weeks" | "months";
}

export function parseCustomRule(rule: string | null | undefined): CustomRule {
  const match = /^every:(\d+):(minutes|hours|days|weeks|months)$/.exec((rule ?? "").trim());
  if (!match) {
    throw new Error(
      `Invalid CUSTOM recurrenceRule "${rule}" — expected "every:<n>:<minutes|hours|days|weeks|months>"`
    );
  }
  return { interval: Number(match[1]), unit: match[2] as CustomRule["unit"] };
}

/**
 * Computes the next UTC fire instant for a recurring reminder, anchored on the instant
 * that just fired (`fromUtc`), expressed in the user's local time so DST transitions
 * never shift the intended wall-clock time (e.g. a 9:00 AM daily reminder stays 9:00 AM
 * local through a DST change, even though the UTC instant shifts by +/- 1 hour).
 */
export function computeNextRecurrence(
  type: ReminderType,
  recurrenceRule: string | null | undefined,
  fromUtc: Date,
  timezone: string
): Date {
  const zone = safeZone(timezone);
  const zoned = DateTime.fromJSDate(fromUtc, { zone: "utc" }).setZone(zone);

  let next: DateTime;
  switch (type) {
    case "DAILY":
      next = zoned.plus({ days: 1 });
      break;
    case "WEEKLY":
      next = zoned.plus({ weeks: 1 });
      break;
    case "MONTHLY":
      next = zoned.plus({ months: 1 });
      break;
    case "CUSTOM": {
      const rule = parseCustomRule(recurrenceRule);
      next = zoned.plus({ [rule.unit]: rule.interval });
      break;
    }
    default:
      throw new Error(`computeNextRecurrence called with non-recurring type ${type}`);
  }
  return next.toUTC().toJSDate();
}

/** Converts a fixed/relative snooze option into an absolute UTC fire instant. */
export function computeSnoozeFireAt(
  option: SnoozeOption,
  opts: { customAt?: Date; timezone: string; now?: Date }
): Date {
  const zone = safeZone(opts.timezone);
  const now = DateTime.fromJSDate(opts.now ?? new Date(), { zone: "utc" }).setZone(zone);

  switch (option) {
    case "5m":
      return now.plus({ minutes: 5 }).toUTC().toJSDate();
    case "10m":
      return now.plus({ minutes: 10 }).toUTC().toJSDate();
    case "30m":
      return now.plus({ minutes: 30 }).toUTC().toJSDate();
    case "1h":
      return now.plus({ hours: 1 }).toUTC().toJSDate();
    case "later_today": {
      let target = now.set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
      if (target <= now) target = target.plus({ days: 1 });
      return target.toUTC().toJSDate();
    }
    case "tomorrow":
      return now.plus({ days: 1 }).toUTC().toJSDate();
    case "next_week":
      return now.plus({ weeks: 1 }).toUTC().toJSDate();
    case "custom": {
      if (!opts.customAt) throw new Error("custom snooze requires customAt");
      return opts.customAt;
    }
    default:
      throw new Error(`Unknown snooze option: ${option}`);
  }
}

/** Whole-day difference, always UTC-based (per NFR3, timestamps are UTC end to end). */
export function diffInDays(from: Date, to: Date): number {
  const a = DateTime.fromJSDate(from, { zone: "utc" }).startOf("day");
  const b = DateTime.fromJSDate(to, { zone: "utc" }).startOf("day");
  return Math.round(b.diff(a, "days").days);
}

export function hoursBetween(from: Date, to: Date): number {
  return DateTime.fromJSDate(to, { zone: "utc" }).diff(DateTime.fromJSDate(from, { zone: "utc" }), "hours").hours;
}
