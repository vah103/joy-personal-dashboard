import test from "node:test";
import assert from "node:assert/strict";
import { renderCompanyMap } from "../src/features/company-live-board/company-live-map-render.js";

test("C011 main view is map-only and has no presence panel", () => {
  const html = renderCompanyMap({
    roles: [{ position: "Research Director", workload: "FREE_FOR_NEW_WORK" }],
    relationships: [],
    handoffs: [],
  }, (key) => key);
  assert.match(html, /company-map-canvas/);
  assert.match(html, /data-company-map-state="FREE"/);
  assert.doesNotMatch(html, /company-board-filters|company-board-summary|company-task-lanes/);
  assert.doesNotMatch(html, /runtimePresence|ONLINE|OFFLINE|<img\b/i);
});
