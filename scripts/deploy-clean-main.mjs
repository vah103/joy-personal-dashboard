import { lstat, mkdtemp, rm, symlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "joy-main-deploy-"));
const worktree = resolve(temporaryRoot, "main");
let worktreeAdded = false;
let linkedNodeModules = false;

function run(command, args, cwd, { capture = false } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });

    let stdout = "";
    if (capture) child.stdout.on("data", (chunk) => { stdout += chunk; });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} ended with signal ${signal}`));
      else if (code !== 0) reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
      else resolveRun(stdout.trim());
    });
  });
}

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

try {
  console.log("Fetching the latest committed main branch…");
  await run("git", ["fetch", "origin", "main"], root);
  const commit = await run("git", ["rev-parse", "origin/main"], root, { capture: true });
  console.log(`Preparing clean deployment worktree at ${commit.slice(0, 12)}…`);

  await run("git", ["worktree", "add", "--detach", worktree, "origin/main"], root);
  worktreeAdded = true;

  const sourceNodeModules = resolve(root, "node_modules");
  const sourceWrangler = resolve(sourceNodeModules, ".bin", "wrangler");
  const targetNodeModules = resolve(worktree, "node_modules");

  if (await exists(sourceWrangler)) {
    await symlink(sourceNodeModules, targetNodeModules, "dir");
    linkedNodeModules = true;
    console.log("Using the repository's existing node_modules in the clean worktree.");
  } else {
    console.log("Installing dependencies inside the clean worktree…");
    await run("npm", ["ci"], worktree);
  }

  console.log("Running the full committed test/build/deploy pipeline from clean origin/main…");
  await run("npm", ["run", "deploy:current"], worktree);
  console.log(`Clean main deployment completed from ${commit}.`);
} finally {
  if (linkedNodeModules) {
    await rm(resolve(worktree, "node_modules"), { force: true });
  }

  if (worktreeAdded) {
    try {
      await run("git", ["worktree", "remove", "--force", worktree], root);
    } catch (error) {
      console.error(`Could not remove temporary worktree automatically: ${error.message}`);
    }
  }

  await rm(temporaryRoot, { recursive: true, force: true });
  await run("git", ["worktree", "prune"], root).catch(() => {});
}
