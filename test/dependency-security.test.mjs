import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("CI and deployment share the high-severity verification gate", async () => {
  const [packageSource, workflow] = await Promise.all([
    read("package.json"),
    read(".github/workflows/ci.yml"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.equal(packageJson.scripts["audit:prod"], "npm audit --omit=dev --audit-level=high");
  assert.equal(packageJson.scripts["audit:all"], "npm audit --audit-level=high");
  assert.equal(
    packageJson.scripts.verify,
    "npm run audit:prod && npm run audit:all && npm run db:migrate:smoke && npm test && npm run build",
  );
  assert.equal(
    packageJson.scripts["deploy:current"],
    "npm run verify && npm run db:migrate:check:remote && wrangler deploy",
  );

  assert.match(workflow, /name: Verify repository[\s\S]*run: npm run verify/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version: 24/);
  assert.doesNotMatch(workflow, /run: npm run audit:(?:prod|all)/);
  assert.doesNotMatch(workflow, /run: npm test/);
  assert.doesNotMatch(workflow, /run: npm run build/);
  assert.doesNotMatch(workflow, /continue-on-error/);
});

test("Dependabot monitors npm and GitHub Actions every week", async () => {
  const config = await read(".github/dependabot.yml");

  assert.match(config, /package-ecosystem: "npm"/);
  assert.match(config, /package-ecosystem: "github-actions"/);
  assert.equal((config.match(/interval: "weekly"/g) || []).length, 2);
  assert.match(config, /timezone: "Asia\/Bangkok"/);
});
