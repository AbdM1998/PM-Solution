import bcrypt from "bcrypt";
import type { RegisterInput, LoginInput } from "@projectflow/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt";

const BCRYPT_COST = 12;

function toPublicUser(user: {
  id: string; email: string; name: string; timezone: string; isAdmin: boolean; whatsappNumber?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    isAdmin: user.isAdmin,
    whatsappNumber: user.whatsappNumber ?? null,
  };
}

/** Registration is open when ALLOW_REGISTRATION isn't "false", or when the database has
 * no users at all yet (so a fresh install can always create its first admin). */
export async function getAuthConfig() {
  if (env.allowRegistration) return { registrationOpen: true };
  return { registrationOpen: (await prisma.user.count()) === 0 };
}

/** Creates (or promotes) the ADMIN_EMAIL account on API start. Idempotent. */
export async function ensureBootstrapAdmin() {
  if (!env.adminEmail || !env.adminPassword) return;
  const email = env.adminEmail.trim().toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existing) {
    if (!existing.isAdmin || !existing.isActive) {
      await prisma.user.update({ where: { id: existing.id }, data: { isAdmin: true, isActive: true } });
      logger.info("Bootstrap admin promoted", { email });
    }
    return;
  }
  await prisma.user.create({
    data: {
      email,
      name: env.adminName,
      passwordHash: await bcrypt.hash(env.adminPassword, BCRYPT_COST),
      isAdmin: true,
    },
  });
  logger.info("Bootstrap admin created", { email });
}

export async function register(input: RegisterInput) {
  if (!(await getAuthConfig()).registrationOpen) {
    throw AppError.forbidden("Self-registration is disabled — ask an administrator to create your account");
  }
  const existing = await prisma.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } } });
  if (existing) throw AppError.conflict("An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const userCount = await prisma.user.count();
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, name: input.name, isAdmin: userCount === 0 },
  });

  return {
    accessToken: signAccessToken(user.id, user.email),
    refreshToken: signRefreshToken(user.id),
    user: toPublicUser(user),
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Constant-shape response either way: never reveal whether the email exists.
  const passwordHash = user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const valid = await bcrypt.compare(input.password, passwordHash);
  if (!user || !valid) throw AppError.unauthorized("Invalid email or password");
  if (!user.isActive) throw AppError.forbidden("This account has been deactivated — contact your administrator");

  return {
    accessToken: signAccessToken(user.id, user.email),
    refreshToken: signRefreshToken(user.id),
    user: toPublicUser(user),
  };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw AppError.unauthorized("Invalid or expired refresh token");

  return {
    accessToken: signAccessToken(user.id, user.email),
    refreshToken: signRefreshToken(user.id),
    user: toPublicUser(user),
  };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound("User not found");
  return toPublicUser(user);
}
