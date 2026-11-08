import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RegisterInput, LoginInput } from "@projectflow/shared";
import { validateBody } from "../../lib/validate";
import { asyncHandler, AppError } from "../../lib/error-handler";
import { requireAuth } from "../../lib/auth-middleware";
import { readCookie } from "../../lib/cookies";
import { env } from "../../lib/env";
import { ttlToMs } from "./jwt";
import * as authService from "./service";

export const authRouter = Router();

// Rate limit auth endpoints specifically against credential stuffing (docs/SECURITY.md).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later", code: "RATE_LIMITED" },
});
authRouter.use(authLimiter);

const REFRESH_COOKIE = "refreshToken";

function setRefreshCookie(res: import("express").Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: ttlToMs(env.refreshTokenTtl),
    path: "/api/auth",
  });
}

authRouter.post(
  "/register",
  validateBody(RegisterInput),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ accessToken: result.accessToken, user: result.user });
  })
);

authRouter.post(
  "/login",
  validateBody(LoginInput),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.json({ accessToken: result.accessToken, user: result.user });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = readCookie(req, REFRESH_COOKIE);
    if (!token) throw AppError.unauthorized("Missing refresh token");
    const result = await authService.refresh(token);
    setRefreshCookie(res, result.refreshToken);
    res.json({ accessToken: result.accessToken, user: result.user });
  })
);

authRouter.post("/logout", (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.status(204).send();
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me(req.user!.id);
    res.json(user);
  })
);
