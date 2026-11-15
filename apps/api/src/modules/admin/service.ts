import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import { env } from "../../lib/env";

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { ownedProjects: true, assignedTasks: true } } },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt.toISOString(),
    projectCount: u._count.ownedProjects,
    taskCount: u._count.assignedTasks,
  }));
}

export async function setUserAdmin(targetUserId: string, requestingUserId: string, isAdmin: boolean) {
  if (targetUserId === requestingUserId && !isAdmin) {
    throw AppError.badRequest("You cannot remove your own admin access");
  }
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw AppError.notFound("User not found");
  await prisma.user.update({ where: { id: targetUserId }, data: { isAdmin } });
}

export async function deleteUser(targetUserId: string, requestingUserId: string) {
  if (targetUserId === requestingUserId) {
    throw AppError.badRequest("You cannot delete your own account");
  }
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw AppError.notFound("User not found");
  await prisma.user.delete({ where: { id: targetUserId } });
}

export function getIntegrationsStatus() {
  return {
    email: {
      configured: Boolean(env.smtpHost),
      from: env.smtpFrom ?? null,
    },
    whatsapp: {
      configured: Boolean(env.whatsappAccessToken && env.whatsappPhoneNumberId),
    },
  };
}
