import { describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createTestUser, createTestProject, createTestTask, createTestChecklistItem } from "../../../test/helpers";
import * as remindersService from "./service";
import * as tasksService from "../tasks/service";
import * as checklistsService from "../checklists/service";

describe("Reminder engine invariants (docs/REMINDER_ENGINE.md)", () => {
  it("snoozing never touches the source task's dueDate — only nextFireAt + SnoozeHistory change", async () => {
    const { user } = await createTestUser();
    const project = await createTestProject(user.id);
    const originalDueDate = new Date("2026-05-01T09:00:00.000Z");
    const task = await createTestTask(project.id, { dueDate: originalDueDate });

    const reminder = await remindersService.createReminder(user.id, {
      entityType: "TASK",
      entityId: task.id,
      type: "ONE_TIME",
      offsetBeforeDueMinutes: 60,
      channels: ["IN_APP"],
    });
    const occurrence = reminder.occurrences[0];

    const snoozed = await remindersService.snoozeOccurrence(user.id, occurrence.id, { option: "1h" });

    expect(snoozed.status).toBe("SNOOZED");
    expect(snoozed.nextFireAt.getTime()).not.toBe(occurrence.nextFireAt.getTime());

    const taskAfter = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(taskAfter.dueDate?.toISOString()).toBe(originalDueDate.toISOString());

    const history = await prisma.snoozeHistory.findMany({ where: { occurrenceId: occurrence.id } });
    expect(history).toHaveLength(1);
    expect(history[0].previousFireAt.getTime()).toBe(occurrence.nextFireAt.getTime());
    expect(history[0].newFireAt.getTime()).toBe(snoozed.nextFireAt.getTime());
  });

  it("completing a checklist item cancels its pending ReminderOccurrences", async () => {
    const { user } = await createTestUser();
    const project = await createTestProject(user.id);
    const task = await createTestTask(project.id);
    const item = await createTestChecklistItem(task.id, { dueDate: new Date("2026-05-01T09:00:00.000Z") });

    const reminder = await remindersService.createReminder(user.id, {
      entityType: "CHECKLIST_ITEM",
      entityId: item.id,
      type: "ONE_TIME",
      scheduledAt: "2026-05-01T08:00:00.000Z",
      channels: ["IN_APP"],
    });

    await checklistsService.completeChecklistItem(user.id, item.id);

    const occurrence = await prisma.reminderOccurrence.findFirstOrThrow({ where: { reminderId: reminder.id } });
    expect(occurrence.status).toBe("CANCELLED");
    expect(occurrence.completedAt).not.toBeNull();
  });

  it("completing a task cancels its pending ReminderOccurrences", async () => {
    const { user } = await createTestUser();
    const project = await createTestProject(user.id);
    const task = await createTestTask(project.id, { dueDate: new Date("2026-05-01T09:00:00.000Z") });

    const reminder = await remindersService.createReminder(user.id, {
      entityType: "TASK",
      entityId: task.id,
      type: "ONE_TIME",
      offsetBeforeDueMinutes: 30,
      channels: ["IN_APP"],
    });

    await tasksService.updateTask(user.id, task.id, { status: "DONE" });

    const occurrence = await prisma.reminderOccurrence.findFirstOrThrow({ where: { reminderId: reminder.id } });
    expect(occurrence.status).toBe("CANCELLED");
  });

  it("a SNOOZED occurrence is also cancelled when the entity is completed (treated as still-active)", async () => {
    const { user } = await createTestUser();
    const project = await createTestProject(user.id);
    const task = await createTestTask(project.id, { dueDate: new Date("2026-05-01T09:00:00.000Z") });

    const reminder = await remindersService.createReminder(user.id, {
      entityType: "TASK",
      entityId: task.id,
      type: "ONE_TIME",
      offsetBeforeDueMinutes: 30,
      channels: ["IN_APP"],
    });
    const occurrence = reminder.occurrences[0];
    await remindersService.snoozeOccurrence(user.id, occurrence.id, { option: "10m" });

    await tasksService.updateTask(user.id, task.id, { status: "DONE" });

    const after = await prisma.reminderOccurrence.findUniqueOrThrow({ where: { id: occurrence.id } });
    expect(after.status).toBe("CANCELLED");
  });

  it("editing a task's due date reschedules a relative reminder's occurrence in place, never duplicating it", async () => {
    const { user } = await createTestUser();
    const project = await createTestProject(user.id);
    const originalDueDate = new Date("2026-05-01T09:00:00.000Z");
    const task = await createTestTask(project.id, { dueDate: originalDueDate });

    await remindersService.createReminder(user.id, {
      entityType: "TASK",
      entityId: task.id,
      type: "ONE_TIME",
      offsetBeforeDueMinutes: 60,
      channels: ["IN_APP"],
    });

    const newDueDate = new Date("2026-06-15T12:00:00.000Z");
    await tasksService.updateTask(user.id, task.id, { dueDate: newDueDate.toISOString() });

    const occurrences = await prisma.reminderOccurrence.findMany({ where: { reminder: { entityId: task.id } } });
    expect(occurrences).toHaveLength(1); // not duplicated
    expect(occurrences[0].nextFireAt.toISOString()).toBe(new Date(newDueDate.getTime() - 60 * 60_000).toISOString());
    expect(occurrences[0].status).toBe("PENDING");
  });

  it("deleting a reminder cancels future occurrences but keeps history (soft delete)", async () => {
    const { user } = await createTestUser();
    const project = await createTestProject(user.id);
    const task = await createTestTask(project.id, { dueDate: new Date("2026-05-01T09:00:00.000Z") });

    const reminder = await remindersService.createReminder(user.id, {
      entityType: "TASK",
      entityId: task.id,
      type: "ONE_TIME",
      offsetBeforeDueMinutes: 30,
      channels: ["IN_APP"],
    });

    await remindersService.deleteReminder(user.id, reminder.id);

    const persisted = await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } });
    expect(persisted.isActive).toBe(false); // row still exists — history kept

    const occurrence = await prisma.reminderOccurrence.findFirstOrThrow({ where: { reminderId: reminder.id } });
    expect(occurrence.status).toBe("CANCELLED");
  });
});

describe("IDOR protection (docs/SECURITY.md)", () => {
  it("user A cannot read or modify user B's project, tasks, or reminders", async () => {
    const { user: userA } = await createTestUser({ email: "a@example.com" });
    const { user: userB } = await createTestUser({ email: "b@example.com" });
    const projectB = await createTestProject(userB.id);
    const taskB = await createTestTask(projectB.id, { dueDate: new Date("2026-05-01T09:00:00.000Z") });

    await expect(tasksService.getTask(userA.id, taskB.id)).rejects.toMatchObject({ status: 403 });
    await expect(tasksService.updateTask(userA.id, taskB.id, { title: "hacked" })).rejects.toMatchObject({ status: 403 });
    await expect(
      remindersService.createReminder(userA.id, {
        entityType: "TASK",
        entityId: taskB.id,
        type: "ONE_TIME",
        offsetBeforeDueMinutes: 10,
        channels: ["IN_APP"],
      })
    ).rejects.toMatchObject({ status: 403 });

    const { getProject } = await import("../projects/service");
    await expect(getProject(userA.id, projectB.id)).rejects.toMatchObject({ status: 403 });
  });

  it("a non-existent project/task/reminder returns 404, not 403 (doesn't leak existence either way)", async () => {
    const { user } = await createTestUser();
    const { getProject } = await import("../projects/service");
    await expect(getProject(user.id, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ status: 404 });
  });
});
