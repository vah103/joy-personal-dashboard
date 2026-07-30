import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../project-data/finance/finance-p1008-refine-v3.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../project-data/finance/finance-p1008-refine-v3.css", import.meta.url), "utf8");
const cacheBust = await readFile(new URL("../scripts/cache-bust-finance-p1008.mjs", import.meta.url), "utf8");

test("P1008 v3 refinement source parses without global observers", () => {
  assert.doesNotThrow(() => new Function(source));
  assert.doesNotMatch(source, /MutationObserver/);
  assert.match(source, /Chia tiền dịch vụ/);
  assert.match(source, /p1008-people-card/);
});

test("P1008 v3 makes both tables narrower and text larger", () => {
  assert.match(styles, /width: min\(760px, 100%\)/);
  assert.match(styles, /width: min\(930px, 100%\)/);
  assert.match(styles, /width: 160px/);
  assert.match(styles, /font-size: 19px/);
  assert.match(styles, /font-size: 13px/);
});

test("P1008 cache bust injects v3 refinement assets", () => {
  assert.match(cacheBust, /joy-finance-p1008-v3/);
  assert.match(cacheBust, /finance-p1008-refine-v3\.css/);
  assert.match(cacheBust, /finance-p1008-refine-v3\.js/);
  assert.match(cacheBust, /joy-finance-p1008-v2/);
});
