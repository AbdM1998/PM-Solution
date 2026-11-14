// Vitest global setup: loads apps/api/.env.test.local (so tests run against a separate
// throwaway database, never the dev-seeded one) before any test file imports the
// Prisma client, then truncates all tables before each test for isolation.
import fs from "fs";
import path from "path";
import { beforeEach, afterAll } from "vitest";

function loadDotEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Refusing to run tests: ${filePath} is missing. Tests truncate every table before ` +
        `each run (see resetDatabase below) — without this file's DATABASE_URL override, ` +
        "they run against whatever DB is already configured, which has already once wiped " +
        "the real dev-seeded database. Create apps/api/.env.test.local pointing at a " +
        "throwaway database before running tests."
    );
  }
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    // Unconditional override, not "only if unset": Vitest/Vite's own built-in env
    // loading already populates process.env.DATABASE_URL from apps/api/.env by the
    // time this runs (confirmed empirically — tests wiped the real dev-seeded
    // database twice before this fix, despite this file existing), so deferring to
    // "already set" defeats the entire point of this override.
    process.env[key] = value;
  }
}

loadDotEnvFile(path.join(__dirname, "..", ".env.test.local"));

// Imported after env vars are set so PrismaClient picks up DATABASE_URL for the test DB.
import { prisma } from "../src/lib/prisma";

const TABLES = [
  "NotificationDelivery",
  "NotificationOutbox",
  "SnoozeHistory",
  "ReminderOccurrence",
  "Reminder",
  "Attachment",
  "EmailMessage",
  "EmailThread",
  "EmailConnection",
  "ActivityLog",
  "ChecklistItemTag",
  "ChecklistItem",
  "ChecklistTemplateItem",
  "ChecklistTemplate",
  "TaskTag",
  "Task",
  "ProjectTag",
  "ProjectMember",
  "Tag",
  "Project",
  "PushSubscription",
  "DeviceToken",
  "WorkerHeartbeat",
  "User",
];

export async function resetDatabase() {
  // Last-resort guard: refuse to truncate anything unless the configured database
  // name unambiguously looks like a throwaway test DB. Cheap insurance against ever
  // repeating the exact mistake this file's loadDotEnvFile override above exists to
  // prevent (this already happened twice against the real dev-seeded database).
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/\/[^/?]*test[^/?]*(\?|$)/i.test(dbUrl)) {
    throw new Error(
      `Refusing to TRUNCATE: DATABASE_URL does not look like a test database (${dbUrl}). ` +
        'Expected the database name in the URL to contain "test".'
    );
  }
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
