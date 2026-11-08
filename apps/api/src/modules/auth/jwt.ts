import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../../lib/env";

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  typ: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  typ: "refresh";
  // rotated every refresh so a leaked old refresh token's signature still verifies but
  // callers are expected to only ever keep the latest one (no server-side revocation
  // list exists in the schema for v1 — see final report for this deviation).
  jti: string;
}

export function signAccessToken(userId: string, email: string): string {
  const payload: AccessTokenPayload = { sub: userId, email, typ: "access" };
  const options: jwt.SignOptions = { expiresIn: env.jwtAccessTtl as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtSecret(), options);
}

export function signRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = { sub: userId, typ: "refresh", jti: randomUUID() };
  const options: jwt.SignOptions = { expiresIn: env.refreshTokenTtl as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtSecret(), options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret()) as AccessTokenPayload;
  if (decoded.typ !== "access") throw new Error("Not an access token");
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret()) as RefreshTokenPayload;
  if (decoded.typ !== "refresh") throw new Error("Not a refresh token");
  return decoded;
}

// Convert "30d" / "15m" style TTL strings to milliseconds, for cookie maxAge.
export function ttlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 15 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 60_000;
  return value * unitMs;
}
