import test from "node:test";
import assert from "node:assert/strict";
import { renderBoardMarkup } from "../src/features/company-live-board/company-live-map.js";

test("C011 Company map entry module loads and renders a read-only dialog", () => {
  const html = renderBoardMarkup({ roles: [], relationships: [], handoffs: [] }, { translate: (key) => key });
  assert.match(html, /role="dialog"/);
  assert.match(html, /company-map-canvas/);
  assert.doesNotMatch(html, /method="POST"/i);
});
