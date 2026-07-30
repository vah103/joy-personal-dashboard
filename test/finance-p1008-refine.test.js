import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../project-data/finance/finance-p1008-refine-v3.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../project-data/finance/finance-p1008-refine-v3.css", import.meta.url), "utf8");
const cacheBust = await readFile(new URL("../scripts/cache-bust-finance-p1008.mjs", import.meta.url), "utf8");

test("P1008 refinement source parses and arranges the overview without global observers", () => {
  assert.doesNotThrow(() => new Function(source));
  assert.doesNotMatch(source, /MutationObserver/);
  assert.match(source, /p1008-overview-grid/);
  assert.match(source, /overview\.append\(summary, servicesCard\)/);
  assert.match(source, /Chia tiền dịch vụ/);
  assert.match(source, /p1008-people-card/);
});

test("P1008 places the summary beside a compact service table", () => {
  assert.match(styles, /width: min\(1000px, 100%\)/);
  assert.match(styles, /grid-template-columns: minmax\(230px, 260px\) minmax\(0, 720px\)/);
  assert.match(styles, /\.p1008-overview-grid \.p1008-summary \{[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /width: 132px/);
  assert.match(styles, /height: 30px/);
  assert.match(styles, /font-size: 18px/);
  assert.match(styles, /font-size: 12px/);
});

test("P1008 adds a fullscreen capture button for the people table", () => {
  assert.match(source, /dataset\.p1008Fullscreen = "true"/);
  assert.match(source, /Toàn màn hình/);
  assert.match(source, /requestFullscreen/);
  assert.match(source, /document\.exitFullscreen/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /p1008-capture-active/);
  assert.match(source, /is-capture-mode/);
});

test("P1008 capture mode fills the viewport and compacts the landscape table", () => {
  assert.match(styles, /\.p1008-people-card\.is-capture-mode[\s\S]*position: fixed/);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /z-index: 2147483000/);
  assert.match(styles, /table-layout: fixed/);
  assert.match(styles, /orientation: landscape/);
  assert.match(styles, /max-height: 520px/);
  assert.match(styles, /overflow: hidden !important/);
});

test("P1008 cache bust injects the refreshed refinement assets", () => {
  assert.match(cacheBust, /joy-finance-p1008-v3/);
  assert.match(cacheBust, /finance-p1008-refine-v3\.css/);
  assert.match(cacheBust, /finance-p1008-refine-v3\.js/);
  assert.match(cacheBust, /joy-finance-p1008-refine-v5/);
  assert.match(cacheBust, /joy-finance-p1008-v2/);
});