import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Daily Day calendar popup renders month progress and date navigation", async () => {
  const [dailyDay, templateEditor, en, vi] = await Promise.all([
    source("src/features/daily-day/daily-day.js"),
    source("scripts/build-daily-day-template-editor.mjs"),
    source("src/i18n/locales/en.js"),
    source("src/i18n/locales/vi.js"),
  ]);

  assert.match(dailyDay, /calendarOpen: false/);
  assert.match(dailyDay, /renderCalendarPopover/);
  assert.match(dailyDay, /data-dd-calendar-date/);
  assert.match(dailyDay, /data-dd-calendar-prev/);
  assert.match(dailyDay, /data-dd-calendar-next/);
  assert.match(dailyDay, /dd-calendar-progress/);
  assert.match(dailyDay, /summary\.percent/);
  assert.match(dailyDay, /aria-expanded/);
  assert.doesNotMatch(dailyDay, /toast\("dailyDay\.calendarLater"\)/);

  assert.match(templateEditor, /effectiveTemplateBlocks\(templateId, dateKey\)\.forEach/);
  assert.match(en, /"dailyDay\.previousMonth": "Previous month"/);
  assert.match(en, /"dailyDay\.nextMonth": "Next month"/);
  assert.match(vi, /"dailyDay\.previousMonth": "Tháng trước"/);
  assert.match(vi, /"dailyDay\.nextMonth": "Tháng sau"/);

  const firstSeptemberDay = new Date(Date.UTC(2026, 8, 1)).getUTCDay();
  assert.equal(firstSeptemberDay, 2, "September 1, 2026 should be Tuesday");
});
