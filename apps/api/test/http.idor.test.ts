import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { createTestUser, createTestProject, createTestTask, authHeader } from "./helpers";

const app = createApp();

describe("HTTP layer IDOR protection", () => {
  it("GET /api/projects/:id returns 403 for a project owned by another user", async () => {
    const { accessToken: tokenA } = await createTestUser({ email: "httpA@example.com" });
    const { user: userB } = await createTestUser({ email: "httpB@example.com" });
    const projectB = await createTestProject(userB.id);

    const res = await request(app).get(`/api/projects/${projectB.id}`).set(authHeader(tokenA));
    expect(res.status).toBe(403);
  });

  it("PATCH /api/projects/:id returns 403 for a project owned by another user", async () => {
    const { accessToken: tokenA } = await createTestUser({ email: "httpA2@example.com" });
    const { user: userB } = await createTestUser({ email: "httpB2@example.com" });
    const projectB = await createTestProject(userB.id);

    const res = await request(app).patch(`/api/projects/${projectB.id}`).set(authHeader(tokenA)).send({ name: "hijacked" });
    expect(res.status).toBe(403);
  });

  it("GET /api/tasks/:id returns 403 for a task in another user's project", async () => {
    const { accessToken: tokenA } = await createTestUser({ email: "httpA3@example.com" });
    const { user: userB } = await createTestUser({ email: "httpB3@example.com" });
    const projectB = await createTestProject(userB.id);
    const taskB = await createTestTask(projectB.id);

    const res = await request(app).get(`/api/tasks/${taskB.id}`).set(authHeader(tokenA));
    expect(res.status).toBe(403);
  });

  it("requires a bearer token at all (401 when missing)", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(401);
  });

  it("the legitimate owner CAN read their own project (sanity check the 403s above are real, not a blanket block)", async () => {
    const { accessToken, user } = await createTestUser({ email: "httpOwner@example.com" });
    const project = await createTestProject(user.id);
    const res = await request(app).get(`/api/projects/${project.id}`).set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(project.id);
  });
});

describe("Auth flow", () => {
  it("register -> me round-trip, and rejects a second registration with the same email", async () => {
    const register = await request(app).post("/api/auth/register").send({
      email: "newuser@example.com",
      password: "Password123!",
      name: "New User",
    });
    expect(register.status).toBe(201);
    expect(register.body.user.email).toBe("newuser@example.com");
    expect(register.body.user.passwordHash).toBeUndefined();

    const me = await request(app).get("/api/auth/me").set(authHeader(register.body.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("newuser@example.com");

    const dup = await request(app).post("/api/auth/register").send({
      email: "newuser@example.com",
      password: "Password123!",
      name: "New User",
    });
    expect(dup.status).toBe(409);
  });

  it("login fails with wrong password", async () => {
    await request(app).post("/api/auth/register").send({
      email: "wrongpass@example.com",
      password: "Password123!",
      name: "User",
    });
    const res = await request(app).post("/api/auth/login").send({ email: "wrongpass@example.com", password: "nope" });
    expect(res.status).toBe(401);
  });
});
