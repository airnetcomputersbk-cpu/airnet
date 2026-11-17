import { spawn } from "node:child_process";
import process from "node:process";

console.log("\x1b[36m%s\x1b[0m", "===================================================");
console.log("\x1b[36m%s\x1b[0m", "🚀 Starting Airnet Computers All-In-One Services...");
console.log("\x1b[36m%s\x1b[0m", "===================================================");

const rootDir = process.cwd();
const isWin = process.platform === "win32";

// 1. Launch Backend API Server (Port 5001)
console.log("\x1b[34m%s\x1b[0m", "➔ Launching Backend API Service on http://localhost:5001...");
const backend = spawn(
  process.execPath,
  ["--env-file=.env", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"],
  {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
  }
);

backend.stdout.on("data", (chunk) => {
  const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    console.log(`\x1b[34m[API 5001]\x1b[0m ${line}`);
  }
});

backend.stderr.on("data", (chunk) => {
  const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    console.log(`\x1b[31m[API ERR]\x1b[0m ${line}`);
  }
});

// 2. Launch Frontend Web Server (Port 5000)
console.log("\x1b[32m%s\x1b[0m", "➔ Launching Frontend Web Service on http://localhost:5000...");
const pnpmCmd = isWin ? "pnpm.cmd" : "pnpm";
const frontend = spawn(
  pnpmCmd,
  ["--filter", "@workspace/airnet-computers", "run", "dev"],
  {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
    shell: isWin,
  }
);

frontend.stdout.on("data", (chunk) => {
  const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    console.log(`\x1b[32m[Web 5000]\x1b[0m ${line}`);
  }
});

frontend.stderr.on("data", (chunk) => {
  const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    console.log(`\x1b[33m[Web Log]\x1b[0m ${line}`);
  }
});

// Clean shutdown handler
let isShuttingDown = false;
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n\x1b[35m[Shutdown]\x1b[0m Received ${signal}. Gracefully stopping all services...`);

  try {
    if (backend && !backend.killed) {
      if (isWin) {
        spawn("taskkill", ["/pid", String(backend.pid), "/f", "/t"]);
      } else {
        backend.kill("SIGTERM");
      }
    }
  } catch {}

  try {
    if (frontend && !frontend.killed) {
      if (isWin) {
        spawn("taskkill", ["/pid", String(frontend.pid), "/f", "/t"]);
      } else {
        frontend.kill("SIGTERM");
      }
    }
  } catch {}

  setTimeout(() => process.exit(0), 1000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
