import { lstat, mkdir, readdir, rm, symlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const feature = String(process.argv[2] || "").toLowerCase();

const configurations = {
  finance: {
    compatibilityPaths: [
      ["finance-demo.js", "src/features/finance/finance.js"],
      ["finance-demo.css", "src/features/finance/finance.css"],
    ],
    syntaxChecks: [
      "src/features/finance/finance.js",
      "src/features/finance/finance-amount-core.js",
      "project-data/finance/finance-layout-v2.js",
      "project-data/finance/finance-dashboard-v1.js",
      "worker/finance-ledger.js",
      "worker/finance-with-seed.js",
      "scripts/build-finance-bundle.mjs",
    ],
    testPattern: /finance/i,
  },
  ielts: {
    compatibilityPaths: [],
    syntaxChecks: [
      "worker/ielts-core.js",
      "src/features/ielts/card.js",
      "src/features/ielts/core-model.js",
      "src/features/ielts/core-ui.js",
      "src/features/ielts/core-actions.js",
      "scripts/validate-ielts-sources.mjs",
    ],
    testPattern: /ielts/i,
  },
};

if (!configurations[feature]) {
  console.error("Usage: node scripts/run-feature-tests.mjs <finance|ielts>");
  process.exit(2);
}

const configuration = configurations[feature];
const created = [];

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function runNode(args) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
  return new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Test process ended with signal ${signal}`));
      else resolveExit(code ?? 1);
    });
  });
}

async function collectTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTests(path));
    else if (/\.test\.(?:c?js|mjs)$/i.test(entry.name)) files.push(path);
  }

  return files;
}

try {
  for (const [legacyPath, sourcePath] of configuration.compatibilityPaths) {
    const legacy = resolve(root, legacyPath);
    const source = resolve(root, sourcePath);
    if (await exists(legacy)) continue;
    if (!await exists(source)) throw new Error(`${feature} source is missing: ${sourcePath}`);

    await mkdir(dirname(legacy), { recursive: true });
    await symlink(relative(dirname(legacy), source) || ".", legacy, "file");
    created.push(legacy);
  }

  for (const path of configuration.syntaxChecks) {
    if (!await exists(resolve(root, path))) throw new Error(`${feature} source is missing: ${path}`);
    const exitCode = await runNode(["--check", path]);
    if (exitCode !== 0) {
      process.exitCode = exitCode;
      break;
    }
  }

  if (!process.exitCode) {
    const allTests = await collectTests(resolve(root, "test"));
    const selectedTests = allTests
      .filter((path) => configuration.testPattern.test(relative(root, path)))
      .sort();

    if (!selectedTests.length) throw new Error(`No ${feature} tests were found.`);
    console.log(`Running ${selectedTests.length} isolated ${feature} test file(s).`);
    process.exitCode = await runNode(["--test", ...selectedTests]);
  }
} finally {
  await Promise.allSettled(created.reverse().map((path) => rm(path, { force: true })));
}
