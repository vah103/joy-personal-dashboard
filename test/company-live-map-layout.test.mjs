import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_LAYOUT } from "../src/features/company-live-board/company-live-map-layout.js";

test("C011 covers all current Company roles and centers USER", () => {
  assert.equal(Object.keys(ROLE_LAYOUT).length, 13);
  assert.deepEqual(ROLE_LAYOUT["Research Director"].slice(0, 2), [500, 318]);
  assert.ok(ROLE_LAYOUT["Research Secretary"]);
  assert.ok(ROLE_LAYOUT["Research Methodologist"]);
  assert.ok(ROLE_LAYOUT["Independent Research QA"]);
  assert.ok(ROLE_LAYOUT["Company Systems Engineer"]);
  assert.ok(ROLE_LAYOUT["Integration + Data Steward"]);
});
