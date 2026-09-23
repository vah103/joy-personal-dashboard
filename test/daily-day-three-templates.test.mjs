import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Daily Day uses only the three Default day templates from 16 Sep onward", async () => {
  const [dailyDay, build, worker, sync, history, vi, en] = await Promise.all([
    source("src/features/daily-day/daily-day.js"),
    source("scripts/build-daily-day.mjs"),
    source("worker/daily-day-sync.js"),
    source("scripts/build-daily-day-sync.mjs"),
    source("scripts/build-daily-day-history.mjs"),
    source("src/i18n/locales/vi.js"),
    source("src/i18n/locales/en.js"),
  ]);

  assert.match(dailyDay, /const TEMPLATE_IDS = \["morning", "afternoon", "no_workout"\]/);
  assert.match(dailyDay, /const THREE_TEMPLATE_START = "2026-09-16"/);
  assert.match(dailyDay, /return dateKey >= THREE_TEMPLATE_START \? "no_workout" : "no_workout"/);
  assert.doesNotMatch(dailyDay, /const WEEKDAY_TEMPLATE/);

  assert.match(build, /no_workout: \[/);
  assert.match(build, /Warmup : bec-deck x2 \(10\)/);
  assert.match(build, /Đẩy tạ đơn 22\.5x3 \(7\)/);
  assert.match(build, /Đẩy vai trước 70x3 \(8\)/);
  assert.match(build, /xịt morr f5/);
  assert.doesNotMatch(build, /monday: weekdayTemplate/);
  assert.doesNotMatch(build, /sunday: \[/);

  assert.match(worker, /new Set\(\["morning", "afternoon", "no_workout"\]\)/);
  assert.match(worker, /three-template-migration/);
  assert.match(worker, /THREE_TEMPLATE_START = "2026-09-16"/);
  assert.match(sync, /type: "three-template-migration", date: "2026-09-16"/);

  assert.doesNotMatch(history, /HISTORICAL_DAYS = Object\.freeze/);
  assert.doesNotMatch(history, /__JOY_DAILY_DAY_HISTORY_BACKFILL__/);
  assert.match(vi, /"dailyDay\.template\.no_workout": "Không tập"/);
  assert.match(en, /"dailyDay\.template\.no_workout": "No workout"/);
});
