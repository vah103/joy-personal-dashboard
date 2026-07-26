import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

await import("../src/features/tasks/todo-visibility.js");
await import("../src/features/tasks/todo-display-policy.js");

const { shouldShowTask } = globalThis.JoyTodo;

test("completed tasks use their displayed task date", () => {
  const now = new Date("2026-07-26T18:30:00+07:00");

  assert.equal(shouldShowTask({
    done: true,
    createdDate: "2026-07-25",
    completedAt: "2026-07-26T18:00:00+07:00",
  }, now), true);

  assert.equal(shouldShowTask({
    done: true,
    createdDate: "2026-07-24",
    completedAt: "2026-07-26T18:00:00+07:00",
  }, now), false);

  assert.equal(shouldShowTask({
    done: true,
    createdDate: "2026-07-23",
    completedAt: "2026-07-26T18:00:00+07:00",
  }, now), false);
});

test("open tasks remain visible regardless of their date", () => {
  assert.equal(shouldShowTask({
    done: false,
    createdDate: "2026-07-20",
  }, new Date("2026-07-26T18:30:00+07:00")), true);
});

test("Cloudflare loads the display policy before the dashboard app", () => {
  const build = fs.readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");
  assert.ok(build.includes('todo-display-policy.js?v=joy-task-window-v1'));
  assert.ok(build.includes('resolve(features, "tasks", "todo-display-policy.js")'));
  assert.ok(
    build.indexOf('todo-display-policy.js?v=joy-task-window-v1')
      < build.indexOf('app.js?v=joy-dashboard-combined-v1'),
  );
});

test("service worker omits unsupported notification actions on iPhone", () => {
  const worker = fs.readFileSync(new URL("../src/pwa/sw.js", import.meta.url), "utf8");
  assert.ok(worker.includes("Notification?.maxActions"));
  assert.ok(worker.includes("if (maxActions > 0"));
  assert.ok(worker.includes("delete options.actions"));
});
