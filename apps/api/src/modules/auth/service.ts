import bcrypt from "bcrypt";
import type { RegisterInput, LoginInput } from "@projectflow/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/error-handler";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt";

const BCRYPT_COST = 12;

function toPublicUser(user: { id: string; email: string; name: string; timezone: string }) {
  return { id: user.id, email: user.email, name: user.name, timezone: user.timezone };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict("An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, name: input.name },
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
  if (!user) throw AppError.unauthorized("Invalid or expired refresh token");

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
