import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, CI: "1", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ended with signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}\n${output.trim()}`));
        return;
      }
      resolveRun(output.trim());
    });
  });
}

const output = await run("npx", [
  "wrangler",
  "d1",
  "migrations",
  "list",
  "joy-dashboard",
  "--remote",
]);

if (/no migrations to apply/i.test(output)) {
  console.log("Remote D1 schema is current");
  process.exit(0);
}

if (/\.sql\b/i.test(output) || /migrations? to be applied/i.test(output)) {
  throw new Error([
    "Remote D1 migrations are pending. Deployment has been stopped.",
    "Apply them first with:",
    "  npm run db:migrate:remote",
    "Then run npm run deploy again.",
    "",
    output,
  ].join("\n"));
}

throw new Error(`Could not confirm the remote D1 migration state.\n${output}`);
