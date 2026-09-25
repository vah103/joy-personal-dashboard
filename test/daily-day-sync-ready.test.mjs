import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Daily Day emits cloud readiness after initialization finishes", async () => {
  const sync = await source("scripts/build-daily-day-sync.mjs");
  assert.match(sync, /initialized = true;\s*window\.__JOY_DAILY_DAY_SYNC_READY__ = true;/);
  assert.match(sync, /window\.dispatchEvent\(new CustomEvent\("joy:daily-day-sync-ready"\)\)/);
});
