import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const saleHtml = fs.readFileSync(new URL("src/pages/sale/index.html", root), "utf8");
const router = fs.readFileSync(new URL("worker/router.js", root), "utf8");

test("Sale Room Summary renders validated AI facts directly without reparsing AI output", () => {
  assert.match(saleHtml, /const AI_ENDPOINT = "\/api\/sales\/room-summary\/analyze"/);
  assert.match(saleHtml, /import \{ renderRoomSummary, summarizeRoomListing \} from "\.\/room-summary\.js"/);
  assert.match(saleHtml, /payload\?\.applied === true && payload\?\.extraction/);
  assert.match(saleHtml, /renderCurrent\(summaryFromExtraction\(payload\.extraction\), \{ semantic: true \}\)/);
  assert.doesNotMatch(saleHtml, /canonicalListing/);
  assert.doesNotMatch(saleHtml, /runLegacyParser\(canonicalListing\)/);
});

test("Sale Room Summary keeps the deterministic parser only as failure fallback", () => {
  assert.match(saleHtml, /const fallback = \(source\) => renderCurrent\(summarizeRoomListing\(source\)\)/);
  assert.match(saleHtml, /else \{\s*fallback\(source\);\s*\}/s);
  assert.match(saleHtml, /catch \{\s*if \(requestGeneration === generation\) fallback\(source\);/s);
});

test("semantic Room Summary supports area, floor, service includes and unknown availability", () => {
  assert.match(saleHtml, /extraction\?\.area\?\.value/);
  assert.match(saleHtml, /extraction\?\.floor\?\.value/);
  assert.match(saleHtml, /service\.includes/);
  assert.match(saleHtml, /cleanup\.sale\.unknownAvailability/);
  assert.match(saleHtml, /cleanup\.sale\.roomArea/);
  assert.match(saleHtml, /cleanup\.sale\.roomFloor/);
});

test("Worker router still owns the stable AI Room Summary endpoint", () => {
  assert.match(router, /handleSaleRoomSummaryAiExtractRequest/);
  assert.match(router, /isSaleRoomSummaryAiExtractRoute\(pathname\)/);
});
