import test from "node:test";
import assert from "node:assert/strict";
import { stateForRole } from "../src/features/company-live-board/company-live-map-layout.js";

test("C011 uses three visual work states", () => {
  assert.equal(stateForRole({ workload: "ACTION_NOW" }), "ACTIVE");
  assert.equal(stateForRole({ workload: "REVIEWING" }), "ACTIVE");
  assert.equal(stateForRole({ workload: "WAITING" }), "WAITING");
  assert.equal(stateForRole({ workload: "BLOCKED" }), "WAITING");
  assert.equal(stateForRole({ workload: "FREE_FOR_NEW_WORK" }), "FREE");
});
