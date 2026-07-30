import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("CI blocks vulnerable production dependencies and critical dependency issues", async () => {
  const [packageSource, workflow] = await Promise.all([
    read("package.json"),
    read(".github/workflows/ci.yml"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.equal(packageJson.scripts["audit:prod"], "npm audit --omit=dev --audit-level=high");
  assert.equal(packageJson.scripts["audit:all"], "npm audit --audit-level=critical");
  assert.match(workflow, /name: Audit production dependencies[\s\S]*run: npm run audit:prod/);
  assert.match(workflow, /name: Audit full dependency tree for critical vulnerabilities[\s\S]*run: npm run audit:all/);
  assert.doesNotMatch(workflow, /continue-on-error/);
});

test("Dependabot monitors npm and GitHub Actions every week", async () => {
  const config = await read(".github/dependabot.yml");

  assert.match(config, /package-ecosystem: "npm"/);
  assert.match(config, /package-ecosystem: "github-actions"/);
  assert.equal((config.match(/interval: "weekly"/g) || []).length, 2);
  assert.match(config, /timezone: "Asia\/Bangkok"/);
});
