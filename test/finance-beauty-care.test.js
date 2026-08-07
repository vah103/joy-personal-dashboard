import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = await readFile(
  new URL("src/features/finance/finance-beauty-care.js", root),
  "utf8",
);
const buildSource = await readFile(
  new URL("scripts/build-finance-bundle.mjs", root),
  "utf8",
);

test("Finance exposes Beauty care with Hair, Face and Other details", () => {
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /id: "haircare"/);
  assert.match(source, /label: "Beauty care"/);
  assert.match(source, /subcategories: Object\.freeze\(\["Hair", "Face", "Other"\]\)/);
});

test("Finance keeps the stable haircare id and maps legacy details", () => {
  assert.match(source, /Haircut: "Hair"/);
  assert.match(source, /"Hair products": "Hair"/);
  assert.match(source, /"Other haircare": "Other"/);
  assert.match(source, /normalizeCategories = function normalizeBeautyCareCategories/);
  assert.match(source, /updateSubcategories = function updateBeautyCareSubcategories/);
});

test("Finance production bundle includes the Beauty care mapping", () => {
  assert.match(buildSource, /finance-beauty-care\.js/);
  assert.match(buildSource, /beautyCareSource\.trim\(\)/);
  assert.match(buildSource, /Finance beauty care category source is missing/);
});
