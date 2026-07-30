import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { handleTaskEnglishRequest } from "../worker/task-english.js";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

async function loadTaskEnglishApi() {
  const helper = await source("src/features/tasks/task-english.js");
  const window = {};
  const document = {
    readyState: "loading",
    addEventListener() {},
    querySelector() { return null; },
  };

  vm.runInNewContext(helper, { window, document, console });
  return window.JoyTaskEnglish;
}

test("new to-do items and reminder titles are rewritten into natural English", async () => {
  const [worker, router, helper, dashboard, build, packageJson] = await Promise.all([
    source("worker/task-english.js"),
    source("worker/router.js"),
    source("src/features/tasks/task-english.js"),
    source("src/pages/dashboard/index.html"),
    source("scripts/build.mjs"),
    source("package.json"),
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
  assert.match(worker, /getSession/);
  assert.match(worker, /AUTH_REQUIRED/);
  assert.match(router, /isTaskEnglishRoute/);
  assert.match(router, /handleTaskEnglishRequest/);
  assert.match(helper, /addEventListener\("submit"/);
  assert.match(helper, /event\.stopImmediatePropagation\(\)/);
  assert.match(helper, /form\.requestSubmit/);
  assert.match(helper, /\/api\/tasks\/english/);
  assert.match(helper, /REQUEST_TIMEOUT_MS = 10_000/);
  assert.match(helper, /joy-task-english-cache-v7/);
  assert.match(helper, /function cleanReminderTitle/);
  assert.match(helper, /function prepareSubmission/);
  assert.match(helper, /composerOpen/);
  assert.match(helper, /replaceAction/);
  assert.match(helper, /"an com": "Eat a meal\."/);
  assert.match(helper, /"chuan bi bua an": "Prepare a meal\."/);
  assert.match(helper, /"cat mong tay": "Trim your nails\."/);
  assert.match(helper, /"mua nuoc giat": "Buy laundry detergent\."/);
  assert.match(helper, /const localTitle = fallbackEnglish\(original\)/);
  assert.match(helper, /const withoutLeadingGo = actionOnly\.replace/);
  assert.match(helper, /it was not added/);
  assert.match(dashboard, /task-english\.js\?v=joy-task-english-v7/);
  assert.match(build, /resolve\(features, "tasks", "task-english\.js"\)/);
  assert.doesNotMatch(packageJson, /cache-bust-task-english\.mjs/);
});

test("task English rejects unauthenticated requests before using AI", async () => {
  let aiCalls = 0;
  const request = new Request("https://app.hey-joy.workers.dev/api/tasks/english", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://app.hey-joy.workers.dev",
    },
    body: JSON.stringify({ text: "hoàn thành báo cáo" }),
  });

  const response = await handleTaskEnglishRequest(request, {
    AI: {
      async run() {
        aiCalls += 1;
        return { response: "Complete the report." };
      },
    },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "AUTH_REQUIRED" });
  assert.equal(aiCalls, 0);
});

test("common Vietnamese tasks with a leading đi use the local English fallback", async () => {
  const { fallbackEnglish } = await loadTaskEnglishApi();

  assert.equal(fallbackEnglish("đi tắm"), "Take a shower.");
  assert.equal(fallbackEnglish("đi cắt tóc"), "Get a haircut.");
  assert.equal(fallbackEnglish("đi tập gym"), "Work out at the gym.");
  assert.equal(fallbackEnglish("đi ngủ"), "Go to sleep.");
});

test("meal preparation works locally with and without reminder timing", async () => {
  const { fallbackEnglish, prepareSubmission } = await loadTaskEnglishApi();

  assert.equal(fallbackEnglish("chuẩn bị bữa ăn"), "Prepare a meal.");
  assert.equal(fallbackEnglish("3 tiếng rưỡi nữa chuẩn bị bữa ăn"), "Prepare a meal.");
  assert.equal(prepareSubmission("3 tiếng rưỡi nữa chuẩn bị bữa ăn").taskText, "chuẩn bị bữa ăn");
});
