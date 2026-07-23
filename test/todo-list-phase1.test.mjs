import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

await import("../todo-visibility.js");

const {
  shouldShowTask,
  vietnamDateKey,
} = globalThis.JoyTodo;

test("keeps an open task visible", () => {
  assert.equal(
    shouldShowTask({
      done: false,
      completedAt: null,
    }, new Date("2026-07-23T20:00:00+07:00")),
    true,
  );
});

test("keeps a completed task visible for the rest of the same Vietnam day", () => {
  assert.equal(
    shouldShowTask({
      done: true,
      completedAt: "2026-07-23T10:15:00+07:00",
    }, new Date("2026-07-23T23:50:00+07:00")),
    true,
  );
});

test("hides a completed task after the Vietnam date changes", () => {
  assert.equal(
    shouldShowTask({
      done: true,
      completedAt: "2026-07-23T23:30:00+07:00",
    }, new Date("2026-07-24T00:01:00+07:00")),
    false,
  );
});

test("Vietnam date helper respects the configured timezone", () => {
  assert.equal(
    vietnamDateKey("2026-07-23T18:00:00Z"),
    "2026-07-24",
  );
});

test("completed tasks are checked, struck through, and retain normal sorting", () => {
  const app = fs.readFileSync(
    new URL("../app.js", import.meta.url),
    "utf8",
  );

  const styles = fs.readFileSync(
    new URL("../styles.css", import.meta.url),
    "utf8",
  );

  assert.ok(app.includes('class="task-row ${task.done ? "completed" : ""}"'));
  assert.ok(app.includes('${task.done ? "checked disabled" : ""}'));
  assert.ok(styles.includes(".task-row.completed .task-title"));
  assert.ok(styles.includes("text-decoration-line: line-through"));
  assert.ok(!app.includes("completedTasks.concat"));
});

test("project deletion requires confirmation and preserves string ids", () => {
  const html = fs.readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8",
  );

  const app = fs.readFileSync(
    new URL("../app.js", import.meta.url),
    "utf8",
  );

  assert.ok(html.includes('id="project-delete-modal"'));
  assert.ok(html.includes('data-action="confirm-delete-project"'));
  assert.ok(app.includes('openProjectDeleteConfirmation(control.dataset.id)'));
  assert.ok(app.includes('String(item.id) !== id'));
  assert.ok(app.includes('backendRequest("/api/projects/archive"'));
  assert.ok(!app.includes("const id = Number(control.dataset.id)"));
});

test("todo helper is loaded before app and copied into dist", () => {
  const html = fs.readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8",
  );

  const build = fs.readFileSync(
    new URL("../scripts/build.mjs", import.meta.url),
    "utf8",
  );

  assert.ok(
    html.indexOf("todo-visibility.js") < html.indexOf("app.js"),
  );

  assert.ok(
    build.includes('resolve(root, "todo-visibility.js")'),
  );
});
