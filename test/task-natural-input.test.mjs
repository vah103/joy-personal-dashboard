import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

async function loadPreviewApi() {
  const source = await readFile(new URL("src/features/tasks/task-natural-input.js", root), "utf8");
  const window = {
    setTimeout,
    clearTimeout,
  };
  const document = {
    readyState: "loading",
    addEventListener() {},
    querySelector() { return null; },
  };

  vm.runInNewContext(source, {
    window,
    document,
    console,
    Date,
    Intl,
    Number,
    String,
    RegExp,
  });

  return window.JoyNaturalReminderPreview;
}

test("natural reminder preview understands Vietnamese half-hour phrases", async () => {
  const { parseNaturalPreview } = await loadPreviewApi();
  const before = Date.now();
  const parsed = parseNaturalPreview("3 tiếng rưỡi nữa phơi quần áo");
  const after = Date.now();

  assert.ok(parsed);
  assert.equal(parsed.repeatType, "once");
  assert.deepEqual(Array.from(parsed.repeatDays), []);
  assert.ok(parsed.dueAt >= before + 210 * 60_000);
  assert.ok(parsed.dueAt <= after + 210 * 60_000);
});

test("natural reminder build cache-busts the updated preview parser", async () => {
  const [packageJson, cacheBust] = await Promise.all([
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("scripts/cache-bust-task-natural-input.mjs", root), "utf8"),
  ]);

  assert.match(packageJson, /cache-bust-task-natural-input\.mjs/);
  assert.match(cacheBust, /joy-natural-reminders-v2/);
});
