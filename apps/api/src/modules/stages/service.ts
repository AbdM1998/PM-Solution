// Per-project lifecycle. A project has an ordered list of stages; the ACTIVE stage is
// the first one (by orderIndex) that isn't completed yet. The only way forward is
// advanceStage(), which refuses while the active stage still has open tasks — so a
// project can't move to its next phase until the current phase's work is actually done.
import type { ProjectStage as DbStage, Prisma } from "@prisma/client";
import type { CreateStageInput, StagePreset, UpdateStageInput } from "@projectflow/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import { assertProjectAccess } from "../../lib/access";

const CLOSED_STATUSES = ["DONE", "CANCELLED"] as const;

export const STAGE_PRESETS: Record<StagePreset, { name: string; description: string }[]> = {
  standard: [
    { name: "Initiation", description: "Define goals, scope and stakeholders" },
    { name: "Planning", description: "Plan schedule, budget, resources and risks" },
    { name: "Execution", description: "Do the work" },
    { name: "Monitoring & Control", description: "Track progress, quality and changes" },
    { name: "Closure", description: "Hand over, sign off and document lessons learned" },
  ],
  software: [
    { name: "Requirements", description: "Gather and approve requirements" },
    { name: "Design", description: "Architecture and UI/UX design" },
    { name: "Development", description: "Build the features" },
    { name: "Testing", description: "QA, UAT and bug fixing" },
    { name: "Deployment", description: "Release to production" },
    { name: "Support", description: "Hypercare and handover to support" },
  ],
  construction: [
    { name: "Feasibility", description: "Site study and feasibility" },
    { name: "Design & Permits", description: "Drawings and approvals" },
    { name: "Procurement", description: "Contracts and materials" },
    { name: "Construction", description: "Build on site" },
    { name: "Handover", description: "Inspection, snag list and handover" },
  ],
};

type StageWithCounts = DbStage & { taskCount: number; closedTaskCount: number };

function toWireStages(stages: StageWithCounts[]) {
  const activeIndex = stages.findIndex((s) => !s.completedAt);
  return stages.map((s, i) => ({
    id: s.id,
    projectId: s.projectId,
    name: s.name,
    description: s.description,
    orderIndex: s.orderIndex,
    completedAt: s.completedAt?.toISOString() ?? null,
    state: s.completedAt ? "COMPLETED" : i === activeIndex ? "ACTIVE" : "LOCKED",
    taskCount: s.taskCount,
    closedTaskCount: s.closedTaskCount,
  }));
}

async function loadStages(projectId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const stages = await db.projectStage.findMany({ where: { projectId }, orderBy: { orderIndex: "asc" } });
  const [totals, closed] = await Promise.all([
    db.task.groupBy({ by: ["stageId"], where: { projectId, stageId: { not: null } }, _count: { _all: true } }),
    db.task.groupBy({
      by: ["stageId"],
      where: { projectId, stageId: { not: null }, status: { in: [...CLOSED_STATUSES] } },
      _count: { _all: true },
    }),
  ]);
  const totalBy = new Map(totals.map((t) => [t.stageId, t._count._all]));
  const closedBy = new Map(closed.map((t) => [t.stageId, t._count._all]));
  return stages.map((s) => ({ ...s, taskCount: totalBy.get(s.id) ?? 0, closedTaskCount: closedBy.get(s.id) ?? 0 }));
}

export async function listStages(userId: string, projectId: string) {
  await assertProjectAccess(userId, projectId);
  return toWireStages(await loadStages(projectId));
}

export async function createStage(userId: string, projectId: string, input: CreateStageInput) {
  await assertProjectAccess(userId, projectId);
  const max = await prisma.projectStage.aggregate({ where: { projectId }, _max: { orderIndex: true } });
  const stage = await prisma.projectStage.create({
    data: { projectId, name: input.name, description: input.description, orderIndex: (max._max.orderIndex ?? -1) + 1 },
  });
  await prisma.activityLog.create({
    data: { projectId, userId, action: "stage.created", metadata: { name: stage.name } },
  });
  const all = toWireStages(await loadStages(projectId));
  return all.find((s) => s.id === stage.id)!;
}

export async function applyPreset(userId: string, projectId: string, preset: StagePreset) {
  await assertProjectAccess(userId, projectId);
  const existing = await prisma.projectStage.count({ where: { projectId } });
  if (existing > 0) throw AppError.conflict("This project already has a lifecycle — add or edit stages instead");
  await prisma.projectStage.createMany({
    data: STAGE_PRESETS[preset].map((s, i) => ({ projectId, name: s.name, description: s.description, orderIndex: i })),
  });
  await prisma.activityLog.create({ data: { projectId, userId, action: "stage.preset_applied", metadata: { preset } } });
  return toWireStages(await loadStages(projectId));
}

async function getStageInProject(projectId: string, stageId: string) {
  const stage = await prisma.projectStage.findUnique({ where: { id: stageId } });
  if (!stage || stage.projectId !== projectId) throw AppError.notFound("Stage not found");
  return stage;
}

export async function updateStage(userId: string, projectId: string, stageId: string, input: UpdateStageInput) {
  await assertProjectAccess(userId, projectId);
  await getStageInProject(projectId, stageId);
  await prisma.projectStage.update({
    where: { id: stageId },
    data: { name: input.name, description: input.description },
  });
  const all = toWireStages(await loadStages(projectId));
  return all.find((s) => s.id === stageId)!;
}

export async function deleteStage(userId: string, projectId: string, stageId: string) {
  await assertProjectAccess(userId, projectId);
  const stage = await getStageInProject(projectId, stageId);
  if (stage.completedAt) throw AppError.conflict("A completed stage can't be deleted — it's part of the project's history");
  // Tasks in it stay in the project, just no longer tied to a stage (FK is SET NULL).
  await prisma.projectStage.delete({ where: { id: stageId } });
  await prisma.activityLog.create({ data: { projectId, userId, action: "stage.deleted", metadata: { name: stage.name } } });
}

export async function reorderStages(userId: string, projectId: string, items: { stageId: string; newIndex: number }[]) {
  await assertProjectAccess(userId, projectId);
  const stages = await prisma.projectStage.findMany({ where: { projectId } });
  const byId = new Map(stages.map((s) => [s.id, s]));
  if (items.length !== stages.length || items.some((i) => !byId.has(i.stageId))) {
    throw AppError.badRequest("Reorder must list every stage of this project exactly once");
  }
  // Completed stages are history: they must stay first, in their original order.
  const ordered = [...items].sort((a, b) => a.newIndex - b.newIndex).map((i) => byId.get(i.stageId)!);
  const completedBefore = stages.filter((s) => s.completedAt).sort((a, b) => a.orderIndex - b.orderIndex);
  const completedPrefix = ordered.slice(0, completedBefore.length);
  const prefixOk = completedPrefix.every((s, i) => s.id === completedBefore[i].id);
  if (!prefixOk) throw AppError.badRequest("Completed stages can't be moved — only upcoming stages can be reordered");

  await prisma.$transaction(
    ordered.map((s, i) => prisma.projectStage.update({ where: { id: s.id }, data: { orderIndex: i } }))
  );
  return toWireStages(await loadStages(projectId));
}

/** Completes the ACTIVE stage and moves the project on to the next one. Refuses while
 * the active stage still has tasks that aren't DONE/CANCELLED. Completing the last
 * stage completes the project itself. */
export async function advanceStage(userId: string, projectId: string) {
  const project = await assertProjectAccess(userId, projectId);
  const stages = await loadStages(projectId);
  if (stages.length === 0) throw AppError.badRequest("This project has no lifecycle stages yet");
  const activeIdx = stages.findIndex((s) => !s.completedAt);
  if (activeIdx === -1) throw AppError.conflict("Every stage of this project is already completed");
  const active = stages[activeIdx];

  const openTasks = await prisma.task.findMany({
    where: { stageId: active.id, status: { notIn: [...CLOSED_STATUSES] } },
    select: { id: true, title: true },
    orderBy: { orderIndex: "asc" },
  });
  if (openTasks.length > 0) {
    const names = openTasks.slice(0, 5).map((t) => `"${t.title}"`).join(", ");
    throw new AppError(
      409,
      "STAGE_HAS_OPEN_TASKS",
      `Finish all tasks in "${active.name}" before moving on — ${openTasks.length} still open: ${names}${openTasks.length > 5 ? "…" : ""}`,
      openTasks
    );
  }

  const isLast = activeIdx === stages.length - 1;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.projectStage.update({ where: { id: active.id }, data: { completedAt: now } });
    if (isLast) {
      await tx.project.update({ where: { id: projectId }, data: { status: "COMPLETED", actualEndDate: now } });
    } else if (project.status === "NOT_STARTED") {
      await tx.project.update({ where: { id: projectId }, data: { status: "IN_PROGRESS" } });
    }
    await tx.activityLog.create({
      data: {
        projectId,
        userId,
        action: isLast ? "stage.lifecycle_completed" : "stage.advanced",
        metadata: { completed: active.name, next: isLast ? null : stages[activeIdx + 1].name },
      },
    });
  });
  return toWireStages(await loadStages(projectId));
}
