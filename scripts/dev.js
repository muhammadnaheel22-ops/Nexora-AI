import { spawn } from "node:child_process";

function start(name, cwd) {
  console.log(`Starting ${name}...`);

  const child = spawn("npm run dev", {
    cwd,
    stdio: "inherit",
    shell: true,
  });

  child.on("error", (error) => {
    console.error(`${name} failed to start:`, error.message);
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${name} stopped with code ${code}`);
    }
  });

  return child;
}

const server = start("Nexora Backend", "./server");
const client = start("Nexora Frontend", "./client");

function shutdown() {
  console.log("\nStopping Nexora AI...");

  server.kill();
  client.kill();

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
