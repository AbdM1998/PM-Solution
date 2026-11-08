import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "../auth/jwt";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";

let io: Server | null = null;

export function initSocketGateway(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: [env.webOrigin, env.mobileOrigin], credentials: true },
  });

  const nsp = io.of("/notifications");
  nsp.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  nsp.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    logger.debug("Socket connected", { userId, socketId: socket.id });
    socket.on("disconnect", () => {
      logger.debug("Socket disconnected", { userId, socketId: socket.id });
    });
  });

  return io;
}

/** Best-effort real-time push. No-ops if the gateway hasn't been initialized (e.g. in
 * unit tests that don't boot an HTTP server) or if the user has no connected socket —
 * the notification is already durably persisted in NotificationOutbox/Delivery either
 * way, so this is purely an enhancement, never the only delivery mechanism. */
export function emitToUser(userId: string, event: string, data: unknown) {
  if (!io) return;
  io.of("/notifications").to(`user:${userId}`).emit(event, data);
}

export function getSocketServer(): Server | null {
  return io;
}
