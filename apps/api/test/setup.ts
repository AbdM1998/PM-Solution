// Vitest global setup: loads apps/api/.env.test.local (so tests run against a separate
// throwaway database, never the dev-seeded one) before any test file imports the
// Prisma client, then truncates all tables before each test for isolation.
import fs from "fs";
import path from "path";
import { beforeEach, afterAll } from "vitest";

function loadDotEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
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
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
