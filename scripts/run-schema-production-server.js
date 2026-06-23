#!/usr/bin/env node
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = join(ROOT, "src", "server.js");

const child = spawn(process.execPath, [serverPath], {
  cwd: ROOT,
  env: {
    ...process.env,
    USE_SCHEMA_QUEUE_READS: "1",
    USE_SCHEMA_OUTCOME_WRITES: "1",
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
