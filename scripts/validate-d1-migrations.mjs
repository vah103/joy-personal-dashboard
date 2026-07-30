import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const persistence = await mkdtemp(join(tmpdir(), "joy-d1-migrations-"));

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, CI: "1", NO_COLOR: "1" },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} ended with signal ${signal}`));
      else if (code !== 0) reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
      else resolveRun();
    });
  });
}

try {
  await run("npx", [
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "joy-dashboard",
    "--local",
    "--persist-to",
    persistence,
  ]);
  console.log("D1 migrations apply cleanly to a fresh local database");
} finally {
  await rm(persistence, { recursive: true, force: true });
}
