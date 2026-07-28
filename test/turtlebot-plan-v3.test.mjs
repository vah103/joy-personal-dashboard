import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimePath = resolve(root, "project-data/turtlebot4/project-plan-v3-ui.js");
const loaderPath = resolve(root, "src/features/project-hub/project-hub-performance.js");
const vietnameseCharacters = /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i;

test("TurtleBot New Plan drives a 12-week schedule with Week 3 current", async () => {
  const [runtime, loader] = await Promise.all([
    readFile(runtimePath, "utf8"),
    readFile(loaderPath, "utf8"),
  ]);

  assert.doesNotThrow(() => new Function(runtime));
  assert.doesNotMatch(runtime, vietnameseCharacters);
  assert.equal((runtime.match(/\n      title: "/g) || []).length, 12);
  assert.match(runtime, /START_DATE = "2026-07-13"/);
  assert.match(runtime, /title: "Navigation Benchmark"/);
  assert.match(runtime, /planEnd: "2026-10-04"/);
  assert.match(runtime, /totalWeeks: 12/);
  assert.match(runtime, /"stage-4"/);
  assert.match(runtime, /New Plan is the primary execution source/);
  assert.match(runtime, /replaceAll\("10-Week Plan", "12-Week Plan"\)/);
  assert.match(loader, /project-plan-v3-ui\.js\?v=turtlebot-new-plan-week3-v1/);

  const start = new Date("2026-07-13T00:00:00+07:00");
  const current = new Date("2026-07-28T00:00:00+07:00");
  const weekNumber = Math.floor((current - start) / (7 * 86400000)) + 1;
  assert.equal(weekNumber, 3);
});
