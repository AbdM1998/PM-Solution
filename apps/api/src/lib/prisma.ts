import { PrismaClient } from "@prisma/client";

// Single shared Prisma client instance for the whole process (API or worker).
// Re-used across modules/tests via this file rather than each module constructing
// its own client, which would exhaust Postgres connections.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
