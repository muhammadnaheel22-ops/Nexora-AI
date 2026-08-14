import { app } from "./app.js";
import { env } from "./config.js";
import { pool, query } from "./db.js";

try {
  await query("SELECT 1");
} catch (error) {
  console.error(`Unable to connect to PostgreSQL (${error.code || error.message}). Check DATABASE_URL and run npm run db:init.`);
  process.exit(1);
}

const server = app.listen(env.PORT, () => console.log(`Nexora API listening on http://localhost:${env.PORT}`));
async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
