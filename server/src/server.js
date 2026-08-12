import { app } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { ensureAgentConfigs } from "./services/agentConfigService.js";

await connectDatabase();
await ensureAgentConfigs();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Nexora API listening");
});

async function shutdown(signal) {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await disconnectDatabase().catch(() => {});
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
