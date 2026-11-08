import http from "http";
import { createApp } from "./app";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { initSocketGateway } from "./modules/notifications/socket";

async function main() {
  await prisma.$connect();

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocketGateway(httpServer);

  httpServer.listen(env.port, () => {
    logger.info(`API listening on port ${env.port}`, { nodeEnv: env.nodeEnv });
  });

  process.on("SIGTERM", async () => {
    logger.info("API shutting down");
    httpServer.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error("API failed to start", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
