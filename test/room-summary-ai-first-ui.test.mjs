import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const saleHtml = fs.readFileSync(new URL("src/pages/sale/index.html", root), "utf8");
const router = fs.readFileSync(new URL("worker/router.js", root), "utf8");

test("Sale Room Summary requests AI analysis before invoking the legacy parser", () => {
  assert.match(saleHtml, /const AI_ENDPOINT = "\/api\/sales\/room-summary\/analyze"/);
  assert.match(saleHtml, /event\.stopImmediatePropagation\(\)/);
  assert.match(saleHtml, /JSON\.stringify\(\{ source \}\)/);
  assert.match(saleHtml, /payload\?\.applied === true && canonicalListing/);
  assert.match(saleHtml, /runLegacyParser\(canonicalListing\)/);
});

test("Sale Room Summary explicitly falls back to the deterministic parser", () => {
  assert.match(saleHtml, /else \{\s*runLegacyParser\(source\);\s*\}/s);
  assert.match(saleHtml, /catch \{\s*if \(requestGeneration === generation\) runLegacyParser\(source\);/s);
});

test("Worker router owns the AI-first Room Summary endpoint", () => {
  assert.match(router, /handleSaleRoomSummaryAiExtractRequest/);
  assert.match(router, /isSaleRoomSummaryAiExtractRoute\(pathname\)/);
});
