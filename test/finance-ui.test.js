import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const financeSource = await readFile(new URL("../src/features/finance/finance.js", import.meta.url), "utf8");
const financeOverlay = await readFile(new URL("../project-data/finance/finance-layout-v2.js", import.meta.url), "utf8");
const buildSource = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("Finance UI source parses before deployment", () => {
  assert.doesNotThrow(() => new Function(financeSource));
});

test("Finance Month view is rendered directly with expandable categories", () => {
  assert.match(financeSource, /function renderMonthView\(content\)/);
  assert.match(financeSource, /finance-ledger-board/);
  assert.match(financeSource, /data-ledger-subcategory/);
  assert.match(financeSource, /finance-ledger-composer/);
  assert.match(financeSource, /bindInlineCategoryForms/);
});

test("Finance privacy only masks the dashboard and the old overlay is retired", () => {
  assert.match(financeSource, /financeData\?\.classList\.toggle\("finance-values-hidden"/);
  assert.doesNotMatch(financeOverlay, /MutationObserver/);
  assert.match(financeOverlay, /no-op/);
});

test("Cloudflare build cache-busts the direct Finance renderer", () => {
  assert.match(buildSource, /finance-demo\.js\?v=joy-finance-core-v4/);
  assert.match(buildSource, /joy-finance-overlay-retired-v1/);
});
