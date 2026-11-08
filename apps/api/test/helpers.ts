import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma";
import { signAccessToken } from "../src/modules/auth/jwt";

export async function createTestUser(overrides: Partial<{ email: string; name: string; timezone: string }> = {}) {
  const passwordHash = await bcrypt.hash("Password123!", 4); // low cost factor: tests only
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash,
      name: overrides.name ?? "Test User",
      timezone: overrides.timezone ?? "UTC",
    },
  });
  const accessToken = signAccessToken(user.id, user.email);
  return { user, accessToken };
}

export async function createTestProject(ownerId: string, overrides: Partial<{ name: string; startDate: Date; targetEndDate: Date | null }> = {}) {
  return prisma.project.create({
    data: {
      ownerId,
      name: overrides.name ?? "Test Project",
      startDate: overrides.startDate ?? new Date(),
      targetEndDate: overrides.targetEndDate ?? null,
    },
  });
}

export async function createTestTask(projectId: string, overrides: Partial<{ title: string; dueDate: Date | null }> = {}) {
  return prisma.task.create({
    data: {
      projectId,
      title: overrides.title ?? "Test Task",
      dueDate: overrides.dueDate ?? null,
    },
  });
}

export async function createTestChecklistItem(taskId: string, overrides: Partial<{ title: string; dueDate: Date | null }> = {}) {
  return prisma.checklistItem.create({
    data: {
      taskId,
      title: overrides.title ?? "Test Checklist Item",
      dueDate: overrides.dueDate ?? null,
    },
  });
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
