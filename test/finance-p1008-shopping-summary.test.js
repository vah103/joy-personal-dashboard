import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../project-data/finance/finance-p1008-shopping-tables-v1.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("P1008 shopping has a service-style three-card summary", () => {
  assert.match(source, /updateShoppingSummary/);
  assert.match(source, /Tổng mua chung/);
  assert.match(source, /Phần của Vanh/);
  assert.match(source, /Thành viên/);
  assert.match(source, /6 người/);
  assert.match(source, /Tự tính theo bảng chia/);
  assert.match(source, /A Mạnh · A Cường · Vanh · Dương · Hưng · Trung/);
  assert.match(source, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(source, /font: 700 29px\/1\.08/);
});

test("P1008 shopping summary recalculates from monthly item data", () => {
  assert.match(source, /const people = calculateMatrix\(items\)/);
  assert.match(source, /items\.reduce\(\(sum, item\) => sum \+ \(Number\(item\.amount\) \|\| 0\), 0\)/);
  assert.match(source, /people\.Vanh\.total/);
  assert.match(source, /\$\{items\.length\} món trong tháng/);
});

test("canonical build refreshes the shopping table script cache key", () => {
  assert.match(build, /finance-p1008-shopping-tables-v1\.js\?v=joy-finance-p1008-shopping-tables-v2/);
});
