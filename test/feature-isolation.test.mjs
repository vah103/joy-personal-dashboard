import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const deploySource = await readFile(new URL("scripts/deploy-clean-main.mjs", root), "utf8");
const featureRunnerSource = await readFile(new URL("scripts/run-feature-tests.mjs", root), "utf8");

test("Finance and IELTS expose independent test commands", () => {
  assert.equal(packageJson.scripts["test:finance"], "node scripts/run-feature-tests.mjs finance");
  assert.equal(packageJson.scripts["test:ielts"], "node scripts/run-feature-tests.mjs ielts");
  assert.match(featureRunnerSource, /finance:\s*\{/);
  assert.match(featureRunnerSource, /ielts:\s*\{/);
  assert.match(featureRunnerSource, /testPattern:\s*\/finance\/i/);
  assert.match(featureRunnerSource, /testPattern:\s*\/ielts\/i/);
});

test("Finance-only tests do not require IELTS sources", () => {
  const financeSection = featureRunnerSource.slice(
    featureRunnerSource.indexOf("finance: {"),
    featureRunnerSource.indexOf("ielts: {"),
  );

  assert.doesNotMatch(financeSection, /src\/features\/ielts|worker\/ielts/);
  assert.match(financeSection, /src\/features\/finance\/finance\.js/);
});

test("normal deployment verifies a clean origin main worktree", () => {
  assert.equal(packageJson.scripts.deploy, "node scripts/deploy-clean-main.mjs");
  assert.equal(packageJson.scripts["deploy:current"], "npm run verify && wrangler deploy");
  assert.match(deploySource, /git", \["fetch", "origin", "main"\]/);
  assert.match(deploySource, /git", \["worktree", "add", "--detach", worktree, "origin\/main"\]/);
  assert.match(deploySource, /npm", \["run", "deploy:current"\]/);
});

test("clean deployment never stashes or resets the developer working tree", () => {
  assert.doesNotMatch(deploySource, /git.*stash|reset --hard|git.*clean/);
  assert.match(deploySource, /worktree", "remove", "--force"/);
});
