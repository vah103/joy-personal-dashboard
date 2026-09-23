import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Daily Day checkbox changes update progress without full rerender", async () => {
  const [dailyDay, build] = await Promise.all([
    source("src/features/daily-day/daily-day.js"),
    source("scripts/build-daily-day.mjs"),
  ]);

  assert.match(dailyDay, /function refreshCheckProgress\(checkbox\)/);
  assert.match(dailyDay, /data-dd-block-count/);
  assert.match(dailyDay, /data-dd-block-progress/);
  assert.match(dailyDay, /data-dd-completed/);
  assert.match(dailyDay, /data-dd-overall-progress/);
  assert.match(dailyDay, /data-dd-done/);
  assert.match(dailyDay, /data-dd-remaining/);

  const changeStart = dailyDay.indexOf('const checkbox = event.target.closest?.("[data-dd-check]")');
  const changeEnd = dailyDay.indexOf('const select = event.target.closest?.("[data-dd-select]")', changeStart);
  assert.ok(changeStart >= 0 && changeEnd > changeStart);
  const checkboxHandler = dailyDay.slice(changeStart, changeEnd);
  assert.match(checkboxHandler, /setCheck\(view\.date, checkbox\.dataset\.ddCheck, checkbox\.checked\)/);
  assert.match(checkboxHandler, /refreshCheckProgress\(checkbox\)/);
  assert.doesNotMatch(checkboxHandler, /renderMain\(\)/);

  assert.match(build, /data-dd-block-count/);
  assert.match(build, /data-dd-block-progress/);
  assert.match(build, /data-dd-done/);
  assert.match(build, /data-dd-remaining/);
  assert.match(build, /refreshCheckProgress/);
});
