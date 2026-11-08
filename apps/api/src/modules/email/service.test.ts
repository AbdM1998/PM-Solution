import { describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createTestUser, createTestProject } from "../../../test/helpers";
import * as emailService from "./service";

const SAMPLE_EML = [
  "From: Alice Example <alice@example.com>",
  "To: Bob Example <bob@example.com>",
  "Cc: carol@example.com",
  "Subject: Project kickoff",
  "Date: Mon, 01 Jun 2026 09:00:00 +0000",
  "Message-ID: <abc123@example.com>",
  "MIME-Version: 1.0",
  "Content-Type: text/html; charset=\"UTF-8\"",
  "",
  "<html><body><p>Hello <b>Bob</b>,</p><script>alert('xss')</script><p>Let's kick off the project.</p></body></html>",
  "",
].join("\r\n");

describe("Email import — real .eml end to end (docs/EMAIL_INTEGRATION.md)", () => {
  it("parses, sanitizes, and stores a real .eml file as an EmailThread + EmailMessage", async () => {
    const { user } = await createTestUser();
    const project = await createTestProject(user.id);

    const result = await emailService.importEmailFile(user.id, project.id, {
      originalname: "kickoff.eml",
      mimetype: "message/rfc822",
      size: Buffer.byteLength(SAMPLE_EML),
      buffer: Buffer.from(SAMPLE_EML, "utf-8"),
    });

    expect(result.thread.source).toBe("IMPORTED_FILE");
    expect(result.thread.subject).toBe("Project kickoff");
    expect(result.message.fromAddress).toBe("alice@example.com");
    expect(result.message.toAddresses).toContain("bob@example.com");
    expect(result.message.ccAddresses).toContain("carol@example.com");

    // Stored-XSS protection: the <script> tag must never survive sanitization.
    expect(result.message.bodyHtml).not.toContain("<script>");
    expect(result.message.bodyHtml).toContain("Hello");
    expect(result.message.bodyHtml).toContain("kick off the project");

    const persisted = await prisma.emailMessage.findUniqueOrThrow({ where: { id: result.message.id } });
    expect(persisted.bodyHtml).not.toContain("<script>");
  });

  it("rejects a file extension outside the .eml/.msg allow-list", async () => {
    const { user } = await createTestUser();
    const project = await createTestProject(user.id);
    await expect(
      emailService.importEmailFile(user.id, project.id, {
        originalname: "note.txt",
        mimetype: "text/plain",
        size: 10,
        buffer: Buffer.from("hello"),
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a file over the size cap", async () => {
    const { user } = await createTestUser();
    const project = await createTestProject(user.id);
    await expect(
      emailService.importEmailFile(user.id, project.id, {
        originalname: "big.eml",
        mimetype: "message/rfc822",
        size: 999_999_999,
        buffer: Buffer.from("hello"),
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("enforces project ownership before importing (IDOR)", async () => {
    const { user: userA } = await createTestUser({ email: "a2@example.com" });
    const { user: userB } = await createTestUser({ email: "b2@example.com" });
    const projectB = await createTestProject(userB.id);

    await expect(
      emailService.importEmailFile(userA.id, projectB.id, {
        originalname: "kickoff.eml",
        mimetype: "message/rfc822",
        size: Buffer.byteLength(SAMPLE_EML),
        buffer: Buffer.from(SAMPLE_EML, "utf-8"),
      })
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("Manual thread linking", () => {
  it("creates a MANUAL-source thread with zero external dependencies", async () => {
    const { user } = await createTestUser();
    const project = await createTestProject(user.id);
    const thread = await emailService.createEmailThread(user.id, project.id, {
      subject: "Contract renewal",
      externalUrl: "https://outlook.office.com/mail/abc",
    });
    expect(thread.source).toBe("MANUAL");
    expect(thread.subject).toBe("Contract renewal");
  });
});

describe("OAuth connect endpoints (Outlook/Gmail) — honest 501 without real credentials", () => {
  it("connectOutlook throws a 501 listing the required env vars", () => {
    expect(() => emailService.connectOutlook()).toThrowError();
    try {
      emailService.connectOutlook();
    } catch (err) {
      expect((err as { status: number }).status).toBe(501);
      expect((err as { details: { requiredEnvVars: string[] } }).details.requiredEnvVars).toContain("MS_GRAPH_CLIENT_ID");
    }
  });

  it("connectGmail throws a 501 listing the required env vars", () => {
    try {
      emailService.connectGmail();
      throw new Error("should not reach here");
    } catch (err) {
      expect((err as { status: number }).status).toBe(501);
      expect((err as { details: { requiredEnvVars: string[] } }).details.requiredEnvVars).toContain("GOOGLE_OAUTH_CLIENT_ID");
    }
  });
});
