import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

function startWorkspace(cwd) {
  const command = isWindows ? process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe" : "npm";
  const args = isWindows ? ["/d", "/s", "/c", "npm.cmd run dev"] : ["run", "dev"];
  return spawn(command, args, { cwd, stdio: "inherit" });
}

const children = [startWorkspace("server"), startWorkspace("client")];

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 250).unref();
}

for (const child of children) {
  child.on("error", (error) => {
    console.error("Unable to start development process:", error.message);
    shutdown();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
