import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../project-data/finance/finance-p1008-refine-v3.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../project-data/finance/finance-p1008-refine-v3.css", import.meta.url), "utf8");
const captureStyles = await readFile(new URL("../project-data/finance/finance-p1008-capture-v2.css", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

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

test("P1008 adds a fullscreen capture button and requests landscape orientation", () => {
  assert.match(source, /dataset\.p1008Fullscreen = "true"/);
  assert.match(source, /Toàn màn hình/);
  assert.match(source, /requestFullscreen/);
  assert.match(source, /document\.exitFullscreen/);
  assert.match(source, /orientation\.lock\("landscape"\)/);
  assert.match(source, /orientation\.unlock\(\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /p1008-capture-active/);
  assert.match(source, /is-capture-mode/);
});

test("P1008 removes the allocated-total footer from the member table", () => {
  assert.match(source, /removeAllocatedFooter/);
  assert.match(source, /Tổng đã phân bổ/);
  assert.match(source, /footer\.remove\(\)/);
  assert.match(captureStyles, /\.p1008-people-table tfoot \{[\s\S]*display: none/);
});

test("P1008 capture mode distributes all six member rows across the viewport", () => {
  assert.match(captureStyles, /height: 100%/);
  assert.match(captureStyles, /display: grid/);
  assert.match(captureStyles, /grid-template-rows: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(captureStyles, /--p1008-capture-columns:/);
  assert.match(captureStyles, /grid-template-columns: var\(--p1008-capture-columns\)/);
  assert.match(captureStyles, /orientation: landscape/);
  assert.match(captureStyles, /orientation: portrait/);
  assert.match(captureStyles, /safe-area-inset-bottom/);
});

test("P1008 fullscreen headers stretch across their complete grid columns", () => {
  assert.match(captureStyles, /thead th:not\(:first-child\):not\(:last-child\)[\s\S]*width: 100%/);
  assert.match(captureStyles, /thead th:last-child,[\s\S]*justify-self: stretch/);
  assert.match(captureStyles, /box-sizing: border-box/);
});

test("P1008 assets are declared by the canonical frontend build", () => {
  assert.match(build, /joy-finance-p1008-v3/);
  assert.match(build, /finance-p1008-refine-v3\.css\?v=joy-finance-p1008-refine-v6/);
  assert.match(build, /finance-p1008-refine-v3\.js\?v=joy-finance-p1008-refine-v6/);
  assert.match(build, /finance-p1008-capture-v2\.css\?v=joy-finance-p1008-capture-v3/);
  assert.doesNotMatch(build, /cache-bust-finance-p1008/);
});
