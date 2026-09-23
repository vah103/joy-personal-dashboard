import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Daily Day cloud pull cannot overwrite optimistic local mutations", async () => {
  const sync = await source("scripts/build-daily-day-sync.mjs");

  assert.match(sync, /let pendingMutations = 0/);
  assert.match(sync, /let latestConfirmedState = null/);
  assert.match(sync, /if \(pulling \|\| !initialized \|\| pendingMutations > 0\) return/);
  assert.match(sync, /const cloud = await request\("GET"\)/);
  assert.match(sync, /if \(pendingMutations > 0\) return;/);

  const patchStart = sync.indexOf("const patch = (mutation) =>");
  const patchEnd = sync.indexOf("const selectedDate =", patchStart);
  assert.ok(patchStart >= 0 && patchEnd > patchStart);
  const patch = sync.slice(patchStart, patchEnd);
  assert.match(patch, /pendingMutations \+= 1/);
  assert.match(patch, /let result = await request\("PATCH", \{ mutation \}\)/);
  assert.match(patch, /latestConfirmedState = result\.data/);
  assert.match(patch, /pendingMutations = Math\.max\(0, pendingMutations - 1\)/);
  assert.match(patch, /if \(pendingMutations !== 0\) return/);
  assert.match(patch, /if \(confirmed\) applyState\(confirmed\)/);
});
