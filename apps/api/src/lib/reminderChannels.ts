// Reminder.channels is stored as a JSON-encoded string (see prisma/schema.prisma's
// comment on that field) so the exact same model definition works on both Postgres
// (the hosted/dev deployment) and SQLite (the local, no-internet deployment) — SQLite
// has no native array column type. Every read/write of that field goes through these
// two functions so application code only ever sees a real ReminderChannel[].
import type { ReminderChannel } from "@prisma/client";

export function encodeChannels(channels: ReminderChannel[]): string {
  return JSON.stringify(channels);
}

export function decodeChannels(raw: string): ReminderChannel[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReminderChannel[]) : [];
  } catch {
    return [];
  }
}
