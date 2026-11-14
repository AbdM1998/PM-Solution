-- Reminder.channels: native Postgres array -> JSON-encoded string (see
-- prisma/schema.prisma's comment on this field — needed so the same model
-- definitions work unmodified against SQLite in the local/offline deployment mode).
-- Data-safe: converts existing array values to their JSON array text form instead of
-- the default drop-and-recreate Prisma proposed (which would have discarded every
-- existing reminder's channel selection).
ALTER TABLE "Reminder" ADD COLUMN "channels_new" TEXT;
UPDATE "Reminder" SET "channels_new" = to_json("channels")::text;
ALTER TABLE "Reminder" ALTER COLUMN "channels_new" SET NOT NULL;
ALTER TABLE "Reminder" DROP COLUMN "channels";
ALTER TABLE "Reminder" RENAME COLUMN "channels_new" TO "channels";
