import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("new to-do items and reminder titles are rewritten into natural English", async () => {
  const [worker, router, helper, build] = await Promise.all([
    source("worker/task-english.js"),
    source("worker/router.js"),
    source("src/features/tasks/task-english.js"),
    source("scripts/build.mjs"),
  ]);

  assert.match(worker, /const TASK_ENGLISH_PATH = "\/api\/tasks\/english"/);
  assert.match(worker, /@cf\/meta\/llama-3\.1-8b-instruct-fast/);
  assert.match(worker, /env\.AI\.run/);
  assert.match(worker, /Translate one personal to-do item into natural English/);
  assert.match(worker, /Remind me to/);
  assert.match(worker, /cắt móng tay -> Trim your nails\./);
  assert.match(worker, /Return only the final English task sentence/);
  assert.match(worker, /extractAiText/);
  assert.doesNotMatch(worker, /json_schema/);
  assert.doesNotMatch(worker, /AUTH_REQUIRED/);
  assert.match(router, /isTaskEnglishRoute/);
  assert.match(router, /handleTaskEnglishRequest/);
  assert.match(helper, /addEventListener\("submit"/);
  assert.match(helper, /event\.stopImmediatePropagation\(\)/);
  assert.match(helper, /form\.requestSubmit/);
  assert.match(helper, /\/api\/tasks\/english/);
  assert.match(helper, /REQUEST_TIMEOUT_MS = 10_000/);
  assert.match(helper, /joy-task-english-cache-v5/);
  assert.match(helper, /function cleanReminderTitle/);
  assert.match(helper, /function prepareSubmission/);
  assert.match(helper, /composerOpen/);
  assert.match(helper, /replaceAction/);
  assert.match(helper, /"an com": "Eat a meal\."/);
  assert.match(helper, /"cat mong tay": "Trim your nails\."/);
  assert.match(helper, /"mua nuoc giat": "Buy laundry detergent\."/);
  assert.match(helper, /const localTitle = fallbackEnglish\(original\)/);
  assert.match(helper, /it was not added/);
  assert.match(build, /task-english\.js\?v=joy-task-english-v5/);
  assert.match(build, /resolve\(features, "tasks", "task-english\.js"\)/);
});
