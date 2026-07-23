import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeScratchpadInput,
  scratchpadRowToApi,
} from "../worker/account-sync.js";

test("normalizes a valid scratchpad update", () => {
  const result = normalizeScratchpadInput({
    content: "Continue TurtleBot localization test",
    baseVersion: 3,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.baseVersion, 3);
});

test("rejects an invalid scratchpad version", () => {
  const result = normalizeScratchpadInput({
    content: "Draft",
    baseVersion: -1,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "INVALID_SCRATCHPAD_VERSION");
});

test("maps an empty scratchpad account", () => {
  assert.deepEqual(scratchpadRowToApi(null), {
    exists: false,
    content: "",
    version: 0,
    updatedAt: 0,
  });
});

test("worker exposes authenticated Scratchpad routes", () => {
  const source = fs.readFileSync(new URL("../worker/index.js", import.meta.url), "utf8");
  assert.ok(source.includes('pathname === "/api/scratchpad"'));
  assert.ok(source.includes("async function getScratchpad"));
  assert.ok(source.includes("async function updateScratchpad"));
});
