import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Daily Day main popup uses the approved compact single-row toolbar", async () => {
  const [dailyDay, build, compactStage, footerStage] = await Promise.all([
    source("src/features/daily-day/daily-day.js"),
    source("scripts/build-daily-day.mjs"),
    source("scripts/build-daily-day-tomorrow.mjs"),
    source("scripts/build-daily-day-footer-cleanup.mjs"),
  ]);

  assert.match(dailyDay, /dd-toolbar dd-toolbar-compact/);
  assert.match(dailyDay, /dd-week/);
  assert.match(dailyDay, /dd-template-select/);
  assert.match(dailyDay, /dd-calendar-icon/);
  assert.match(dailyDay, /dd-edit-icon/);
  assert.match(dailyDay, /data-dd-select/);
  assert.match(dailyDay, /data-dd-calendar/);
  assert.match(dailyDay, /data-dd-library/);

  const start = dailyDay.indexOf('root.innerHTML = `<header class="dd-head"');
  const end = dailyDay.indexOf("  function renderLibrary()");
  const mainMarkup = dailyDay.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(mainMarkup, /<div class="dd-templatebar">/);
  assert.doesNotMatch(mainMarkup, /data-dd-tomorrow/);
  assert.doesNotMatch(mainMarkup, /changeTemplate/);

  assert.match(build, /grid-template-columns: minmax\(0, 1fr\) minmax\(190px, 260px\) 38px 38px/);
  assert.match(build, /#daily-day-modal \.dd-toolbar-icon svg/);
  assert.doesNotMatch(build, /#daily-day-modal \.dd-templatebar \{/);

  assert.match(compactStage, /compact single-row toolbar/);
  assert.doesNotMatch(compactStage, /data-dd-tomorrow>Tomorrow<\/button>/);
  assert.match(footerStage, /preserved compact toolbar/);
});
