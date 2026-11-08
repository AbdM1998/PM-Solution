// Centralized IDOR guards: every project-scoped route (projects, tasks, checklist
// items, reminders) must verify the caller owns the project or is a ProjectMember
// before reading or writing anything, per docs/SECURITY.md. These helpers are the
// single place that check runs, so it can't be forgotten in one route and not another.
import { prisma } from "./prisma";
import { AppError } from "./error-handler";

export async function assertProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw AppError.notFound("Project not found");
  if (project.ownerId === userId) return project;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw AppError.forbidden("You do not have access to this project");
  return project;
}

export async function assertTaskAccess(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw AppError.notFound("Task not found");
  await assertProjectAccess(userId, task.projectId);
  return task;
}

export async function assertChecklistItemAccess(userId: string, checklistItemId: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id: checklistItemId } });
  if (!item) throw AppError.notFound("Checklist item not found");
  const task = await prisma.task.findUnique({ where: { id: item.taskId } });
  if (!task) throw AppError.notFound("Task not found");
  await assertProjectAccess(userId, task.projectId);
  return { item, task };
}

/**
 * Resolves the project + display title for a polymorphic Reminder.entityType/entityId
 * pair, and enforces the same project-access check. Used by reminders/dashboard.
 */
export async function resolveEntityContext(
  entityType: "PROJECT" | "TASK" | "CHECKLIST_ITEM",
  entityId: string
): Promise<{ projectId: string; projectName: string; title: string; dueDate: Date | null }> {
  if (entityType === "PROJECT") {
    const project = await prisma.project.findUnique({ where: { id: entityId } });
    if (!project) throw AppError.notFound("Project not found");
    return { projectId: project.id, projectName: project.name, title: project.name, dueDate: project.targetEndDate };
  }
  if (entityType === "TASK") {
    const task = await prisma.task.findUnique({ where: { id: entityId }, include: { project: true } });
    if (!task) throw AppError.notFound("Task not found");
    return { projectId: task.projectId, projectName: task.project.name, title: task.title, dueDate: task.dueDate };
  }
  // CHECKLIST_ITEM
  const item = await prisma.checklistItem.findUnique({
    where: { id: entityId },
    include: { task: { include: { project: true } } },
  });
  if (!item) throw AppError.notFound("Checklist item not found");
  return {
    projectId: item.task.projectId,
    projectName: item.task.project.name,
    title: item.title,
    dueDate: item.dueDate,
  };
}

export async function assertEntityAccess(
  userId: string,
  entityType: "PROJECT" | "TASK" | "CHECKLIST_ITEM",
  entityId: string
) {
  const ctx = await resolveEntityContext(entityType, entityId);
  await assertProjectAccess(userId, ctx.projectId);
  return ctx;
}
