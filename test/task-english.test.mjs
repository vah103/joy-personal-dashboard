import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("new to-do items are rewritten into natural English before saving", async () => {
  const [worker, router, helper, build] = await Promise.all([
    source("worker/task-english.js"),
    source("worker/router.js"),
    source("src/features/tasks/task-english.js"),
    source("scripts/build.mjs"),
  ]);

  assert.match(worker, /const TASK_ENGLISH_PATH = "\/api\/tasks\/english"/);
  assert.match(worker, /env\.AI\.run/);
  assert.match(worker, /concise imperative structure/);
  assert.match(worker, /Remind me to/);
  assert.match(router, /isTaskEnglishRoute/);
  assert.match(router, /handleTaskEnglishRequest/);
  assert.match(helper, /addEventListener\("submit"/);
  assert.match(helper, /event\.stopImmediatePropagation\(\)/);
  assert.match(helper, /form\.requestSubmit/);
  assert.match(helper, /\/api\/tasks\/english/);
  assert.match(build, /task-english\.js\?v=joy-task-english-v1/);
  assert.match(build, /resolve\(features, "tasks", "task-english\.js"\)/);
});
