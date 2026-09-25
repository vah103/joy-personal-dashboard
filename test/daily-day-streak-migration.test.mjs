import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("legacy streak check-ins migrate without losing Finasteride carry", async () => {
  const [streak, worker, sync] = await Promise.all([
    source("scripts/build-daily-day-streak.mjs"),
    source("worker/daily-day-sync.js"),
    source("scripts/build-daily-day-sync.mjs"),
  ]);

  for (const value of ["no-snacks", "no-masturbate", "finasteride"]) {
    assert.match(streak, new RegExp(value));
    assert.match(worker, new RegExp(value));
  }
  assert.match(streak, /name: "Finasteride", targetDays: 100, baseCarry: 2/);
  assert.match(worker, /name: "Finasteride", targetDays: 100, baseCarry: 2/);
  assert.match(streak, /legacyImported: true/);
  assert.match(worker, /legacyImported: true/);
  assert.match(streak, /legacyDays: days/);
  assert.match(worker, /legacyDays/);
  assert.match(sync, /date: "2026-09-25"/);
});
