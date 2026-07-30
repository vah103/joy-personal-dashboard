import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../project-data/finance/finance-p1008-shopping-tables-v1.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../project-data/finance/finance-p1008-shopping-tables-v1.css", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8");

test("P1008 shopping no longer inserts a separate three-card summary", () => {
  assert.doesNotMatch(source, /updateShoppingSummary/);
  assert.doesNotMatch(source, /Tổng mua chung/);
  assert.doesNotMatch(source, /Phần của Vanh/);
  assert.match(source, /summary\?\.remove\(\)/);
  assert.match(styles, /\.p1008-shopping-summary[\s\S]*display: none !important/);
});

test("P1008 shopping uses the same two card families as service splitting", () => {
  assert.match(source, /p1008-services-card p1008-shopping-items-card/);
  assert.match(source, /p1008-people-card p1008-shopping-people-card/);
  assert.match(source, /p1008-services-table/);
  assert.match(source, /p1008-people-table/);
});

test("canonical dashboard emits both final shopping table asset versions", () => {
  assert.match(dashboard, /finance-p1008-shopping-tables-v1\.css\?v=joy-finance-p1008-shopping-tables-v3/);
  assert.match(dashboard, /finance-p1008-shopping-tables-v1\.js\?v=joy-finance-p1008-shopping-tables-v3/);
});
