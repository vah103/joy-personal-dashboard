import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const packageJson = JSON.parse(read("package.json"));
const build = read("scripts/build.mjs");
const financeBundle = read("scripts/build-finance-bundle.mjs");
const removedPatches = [
  "scripts/cache-bust-finance-p1008.mjs",
  "scripts/cache-bust-task-english.mjs",
  "scripts/cache-bust-task-natural-input.mjs",
  "scripts/cache-bust-turtlebot-plan.mjs",
];

test("frontend build has one canonical HTML owner", () => {
  assert.equal(
    packageJson.scripts.build,
    "node scripts/validate-ielts-sources.mjs && node scripts/build.mjs && node scripts/build-finance-bundle.mjs",
  );
  for (const path of removedPatches) {
    assert.equal(fs.existsSync(new URL(path, root)), false, `${path} must remain removed`);
  }
});

test("build emits final production asset versions directly", () => {
  for (const reference of [
    "finance-demo.js?v=joy-finance-core-v9",
    "joy-finance-p1008-v3",
    "joy-finance-p1008-refine-v5",
    "task-english.js?v=joy-task-english-v7",
    "task-natural-input.js?v=joy-natural-reminders-v2",
    "speaking-loader.js?v=joy-speaking-loader-v1",
    "vocabulary-loader.js?v=joy-vocabulary-loader-v1",
    "project-hub-performance.js?v=turtlebot-hub-lifecycle-v1",
    "turtlebot-plan-loader.js?v=turtlebot-plan-loader-v1",
  ]) {
    assert.match(build, new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("secondary builders never rewrite dist index HTML", () => {
  assert.doesNotMatch(financeBundle, /index\.html/);
  assert.doesNotMatch(financeBundle, /replaceAll?\(/);
  assert.match(financeBundle, /writeFile\(financeBundlePath, bundle\)/);
});
