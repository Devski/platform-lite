#!/usr/bin/env node
// SSH tunnel to the dev database: localhost:5433 -> instance 127.0.0.1:5432.
// Reads DEV_SSH_HOST from the environment or .env. Stop with Ctrl+C.
// Cross-platform on purpose: pnpm runs package scripts through cmd.exe on Windows,
// so this cannot be a bash script.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

let host = process.env.DEV_SSH_HOST;
if (!host) {
  try {
    const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
    host = env.match(/^DEV_SSH_HOST=(.+)$/m)?.[1]?.trim();
  } catch {
    // no .env — reported below
  }
}
if (!host) {
  console.error(
    "DEV_SSH_HOST is not set (environment or .env). Expected e.g. ubuntu@<instance-ip> — see docs/dev-environment.md",
  );
  process.exit(1);
}

const args = ["-N", "-L", "5433:127.0.0.1:5432", host];
console.log(`Tunnel up: localhost:5433 -> ${host} (Ctrl+C to stop)`);
const ssh = spawn("ssh", args, { stdio: "inherit" });
ssh.on("error", (err) => {
  console.error(`Failed to start ssh: ${err.message}`);
  process.exit(1);
});
ssh.on("exit", (code) => process.exit(code ?? 0));
