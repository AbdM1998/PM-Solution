import { describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createTestUser } from "../../../test/helpers";
import * as projectsService from "../projects/service";
import * as tasksService from "../tasks/service";
import * as checklistService from "../checklists/service";
import * as stagesService from "./service";

async function setup() {
  const { user } = await createTestUser();
  const project = await projectsService.createProject(user.id, { name: "Lifecycle", startDate: new Date().toISOString() });
  const stages = await stagesService.applyPreset(user.id, project.id, "standard");
  return { user, project, stages };
}

describe("Task can't be closed until its checklist is complete", () => {
  it("rejects DONE while a checklist item is pending, accepts it once completed", async () => {
    const { user, project } = await setup();
    const task = await tasksService.createTask(user.id, project.id, { title: "T" });
    const item = await checklistService.createChecklistItem(user.id, task.id, { title: "step" });

    await expect(tasksService.updateTask(user.id, task.id, { status: "DONE" })).rejects.toMatchObject({
      status: 409,
      code: "CHECKLIST_INCOMPLETE",
    });
    await expect(tasksService.bulkCompleteTasks(user.id, [task.id])).rejects.toMatchObject({ status: 409 });

    await checklistService.completeChecklistItem(user.id, item.id);
    const done = await tasksService.updateTask(user.id, task.id, { status: "DONE" });
    expect(done.status).toBe("DONE");
  });

  it("nested (child) pending items also block closing", async () => {
    const { user, project } = await setup();
    const task = await tasksService.createTask(user.id, project.id, { title: "T" });
    const parent = await checklistService.createChecklistItem(user.id, task.id, { title: "parent" });
    await checklistService.createChecklistItem(user.id, task.id, { title: "child", parentId: parent.id });
    await checklistService.completeChecklistItem(user.id, parent.id);
    await expect(tasksService.updateTask(user.id, task.id, { status: "DONE" })).rejects.toMatchObject({ status: 409 });
  });

  it("a closed task's checklist can't gain or reopen items", async () => {
    const { user, project } = await setup();
    const task = await tasksService.createTask(user.id, project.id, { title: "T" });
    const item = await checklistService.createChecklistItem(user.id, task.id, { title: "step" });
    await checklistService.completeChecklistItem(user.id, item.id);
    await tasksService.updateTask(user.id, task.id, { status: "DONE" });

    await expect(checklistService.createChecklistItem(user.id, task.id, { title: "late" })).rejects.toMatchObject({
      code: "TASK_CLOSED",
    });
    await expect(
      checklistService.updateChecklistItem(user.id, item.id, { status: "PENDING" })
    ).rejects.toMatchObject({ code: "TASK_CLOSED" });
  });
});

describe("Project lifecycle gating", () => {
  it("first stage is ACTIVE and the rest LOCKED", async () => {
    const { stages } = await setup();
    expect(stages.map((s) => s.state)).toEqual(["ACTIVE", "LOCKED", "LOCKED", "LOCKED", "LOCKED"]);
  });

  it("can't advance while the active stage has open tasks; can once they're done or cancelled", async () => {
    const { user, project, stages } = await setup();
    const a = await tasksService.createTask(user.id, project.id, { title: "A", stageId: stages[0].id });
    const b = await tasksService.createTask(user.id, project.id, { title: "B", stageId: stages[0].id });
    // A task in a LATER stage doesn't block the current one.
    await tasksService.createTask(user.id, project.id, { title: "later", stageId: stages[1].id });

    await expect(stagesService.advanceStage(user.id, project.id)).rejects.toMatchObject({
      status: 409,
      code: "STAGE_HAS_OPEN_TASKS",
    });
    await tasksService.updateTask(user.id, a.id, { status: "DONE" });
    await tasksService.updateTask(user.id, b.id, { status: "CANCELLED" });

    const after = await stagesService.advanceStage(user.id, project.id);
    expect(after[0].state).toBe("COMPLETED");
    expect(after[1].state).toBe("ACTIVE");
    const proj = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(proj.status).toBe("IN_PROGRESS");
  });

  it("completed stages are frozen: no new open tasks, no reopening, no delete, no reorder", async () => {
    const { user, project, stages } = await setup();
    const t = await tasksService.createTask(user.id, project.id, { title: "A", stageId: stages[0].id });
    await tasksService.updateTask(user.id, t.id, { status: "DONE" });
    await stagesService.advanceStage(user.id, project.id);

    await expect(
      tasksService.createTask(user.id, project.id, { title: "late", stageId: stages[0].id })
    ).rejects.toMatchObject({ code: "STAGE_COMPLETED" });
    await expect(tasksService.updateTask(user.id, t.id, { status: "TODO" })).rejects.toMatchObject({
      code: "STAGE_COMPLETED",
    });
    await expect(stagesService.deleteStage(user.id, project.id, stages[0].id)).rejects.toMatchObject({ status: 409 });
    const swapped = stages.map((s, i) => ({ stageId: s.id, newIndex: i === 0 ? 1 : i === 1 ? 0 : i }));
    await expect(stagesService.reorderStages(user.id, project.id, swapped)).rejects.toMatchObject({ status: 400 });
  });

  it("upcoming stages can be reordered", async () => {
    const { user, project, stages } = await setup();
    const swapped = stages.map((s, i) => ({ stageId: s.id, newIndex: i === 3 ? 4 : i === 4 ? 3 : i }));
    const after = await stagesService.reorderStages(user.id, project.id, swapped);
    expect(after[3].id).toBe(stages[4].id);
    expect(after[4].id).toBe(stages[3].id);
  });

  it("completing the last stage completes the project", async () => {
    const { user, project } = await setup();
    let result;
    for (let i = 0; i < 5; i++) result = await stagesService.advanceStage(user.id, project.id);
    expect(result!.every((s) => s.state === "COMPLETED")).toBe(true);
    const proj = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(proj.status).toBe("COMPLETED");
    expect(proj.actualEndDate).not.toBeNull();
    await expect(stagesService.advanceStage(user.id, project.id)).rejects.toMatchObject({ status: 409 });
  });

  it("another user without access can't read or advance the lifecycle", async () => {
    const { project } = await setup();
    const { user: stranger } = await createTestUser();
    await expect(stagesService.listStages(stranger.id, project.id)).rejects.toMatchObject({ status: 403 });
    await expect(stagesService.advanceStage(stranger.id, project.id)).rejects.toMatchObject({ status: 403 });
  });
});
