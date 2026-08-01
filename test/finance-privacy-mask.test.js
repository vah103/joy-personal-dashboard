import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("outer Finance privacy mode uses fixed skeleton bars instead of dot masks", async () => {
  const [styles, finance, build] = await Promise.all([
    read("src/features/finance/finance-privacy-mask.css"),
    read("src/features/finance/finance.js"),
    read("scripts/build-finance-bundle.mjs"),
  ]);

  assert.match(finance, /classList\.toggle\("finance-values-hidden", hidden\)/);
  assert.match(styles, /#finance #finance-data\.finance-values-hidden \[data-finance-value\]/);
  assert.match(styles, /font-size: 0 !important/);
  assert.match(styles, /\[data-finance-value\]::after/);
  assert.match(styles, /border-radius: 999px/);
  assert.match(styles, /\[data-finance-field="remaining"\][\s\S]*--finance-mask-width: 148px/);
  assert.match(styles, /\[data-finance-field="income"\][\s\S]*--finance-mask-width: 86px/);
  assert.match(styles, /\[data-finance-field="expenses"\][\s\S]*--finance-mask-width: 74px/);
  assert.match(styles, /\[data-finance-field="year-end"\][\s\S]*--finance-mask-width: 108px/);
  assert.match(styles, /\.finance-year-end-gold \[data-finance-value\][\s\S]*--finance-mask-width: 52px/);
  assert.doesNotMatch(styles, /animation\s*:/);
  assert.doesNotMatch(styles, /@keyframes/);

  assert.match(build, /privacyMaskCss: resolve\(financeSourceDir, "finance-privacy-mask\.css"\)/);
  assert.match(build, /readFile\(paths\.privacyMaskCss, "utf8"\)/);
  assert.match(build, /privacyMaskCss\.trim\(\)/);
});
