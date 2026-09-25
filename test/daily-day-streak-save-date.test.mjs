import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Streak Save accepts ISO date values produced by input type=date", async () => {
  const streak = await source("scripts/build-daily-day-streak.mjs");
  const correctPattern = String.raw`const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;`;
  const brokenPattern = String.raw`/^\\d{4}-\\d{2}-\\d{2}$/`;

  assert.ok(streak.includes(correctPattern));
  assert.equal(streak.includes(brokenPattern), false);
  assert.match(streak, /DATE_KEY_RE\.test\(dateKey\)/);
  assert.match(streak, /DATE_KEY_RE\.test\(startDate\)/);

  const runtime = /^\d{4}-\d{2}-\d{2}$/;
  assert.equal(runtime.test("2026-09-26"), true);
  assert.equal(runtime.test("09/26/2026"), false);
});
