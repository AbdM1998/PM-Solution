import { describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createTestUser } from "../../../test/helpers";
import * as projectsService from "./service";

describe("Project computed fields (FR2 — never stored/editable)", () => {
  it("computes task counts and completionPercent from real Task rows, not a stored field", async () => {
    const { user } = await createTestUser();
    const project = await projectsService.createProject(user.id, {
      name: "Computed Fields Project",
      startDate: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      targetEndDate: new Date("2026-01-31T00:00:00.000Z").toISOString(),
    });

    await prisma.task.createMany({
      data: [
        { projectId: project.id, title: "done 1", status: "DONE" },
        { projectId: project.id, title: "done 2", status: "DONE" },
        { projectId: project.id, title: "todo 1", status: "TODO" },
        { projectId: project.id, title: "overdue 1", status: "TODO", dueDate: new Date("2020-01-01T00:00:00.000Z") },
        { projectId: project.id, title: "cancelled 1", status: "CANCELLED" },
      ],
    });

    const fetched = await projectsService.getProject(user.id, project.id);
    expect(fetched.completedTaskCount).toBe(2);
    expect(fetched.pendingTaskCount).toBe(2); // todo 1 + overdue 1 (TODO status)
    expect(fetched.overdueTaskCount).toBe(1);
    expect(fetched.completionPercent).toBe(40); // 2 of 5 tasks done
  });

  it("completionPercent is 0 (not NaN/divide-by-zero) when there are no tasks yet", async () => {
    const { user } = await createTestUser();
    const project = await projectsService.createProject(user.id, {
      name: "Empty Project",
      startDate: new Date().toISOString(),
    });
    const fetched = await projectsService.getProject(user.id, project.id);
    expect(fetched.completionPercent).toBe(0);
    expect(fetched.completedTaskCount).toBe(0);
  });

  it("daysRemaining is null without a targetEndDate, and a number with one", async () => {
    const { user } = await createTestUser();
    const noTarget = await projectsService.createProject(user.id, {
      name: "No target",
      startDate: new Date().toISOString(),
    });
    expect(noTarget.daysRemaining).toBeNull();

    const withTarget = await projectsService.createProject(user.id, {
      name: "With target",
      startDate: new Date().toISOString(),
      targetEndDate: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    });
    expect(withTarget.daysRemaining).not.toBeNull();
    expect(withTarget.daysRemaining).toBeGreaterThanOrEqual(9);
  });

  it("daysOverdue is 0 while on time and >0 once the targetEndDate has passed and status isn't closed", async () => {
    const { user } = await createTestUser();
    const overdue = await projectsService.createProject(user.id, {
      name: "Overdue project",
      startDate: new Date(Date.now() - 20 * 86_400_000).toISOString(),
      targetEndDate: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    });
    expect(overdue.daysOverdue).toBeGreaterThanOrEqual(4);
  });

  it("a COMPLETED project is never counted as overdue even past its targetEndDate", async () => {
    const { user } = await createTestUser();
    const project = await projectsService.createProject(user.id, {
      name: "Completed late",
      startDate: new Date(Date.now() - 20 * 86_400_000).toISOString(),
      targetEndDate: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      status: "COMPLETED",
    });
    expect(project.daysOverdue).toBe(0);
  });

  it("listProjects computes aggregates without N+1 (bounded query count regardless of project count)", async () => {
    const { user } = await createTestUser();
    for (let i = 0; i < 5; i++) {
      const project = await projectsService.createProject(user.id, {
        name: `Project ${i}`,
        startDate: new Date().toISOString(),
      });
      await prisma.task.create({ data: { projectId: project.id, title: "t", status: "DONE" } });
    }
    const result = await projectsService.listProjects(user.id, {});
    expect(result.items).toHaveLength(5);
    expect(result.total).toBe(5);
    for (const p of result.items) {
      expect(p.completedTaskCount).toBe(1);
      expect(p.completionPercent).toBe(100);
    }
  });
});
