import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tablesSource = await readFile(new URL("../project-data/finance/finance-p1008-shopping-tables-v1.js", import.meta.url), "utf8");
const tablesStyles = await readFile(new URL("../project-data/finance/finance-p1008-shopping-tables-v1.css", import.meta.url), "utf8");
const shoppingSource = await readFile(new URL("../project-data/finance/finance-p1008-shopping-v1.js", import.meta.url), "utf8");
const buildSource = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("P1008 shopping keeps monthly manual entry behind a compact add control", () => {
  assert.doesNotThrow(() => new Function(tablesSource));
  assert.match(shoppingSource, /data-shopping-new-name/);
  assert.match(shoppingSource, /data-shopping-new-amount/);
  assert.match(shoppingSource, /data-shopping-new-split/);
  assert.match(tablesSource, /p1008-shopping-add-toggle/);
  assert.match(tablesSource, /\+ Thêm món/);
  assert.match(tablesSource, /form\.hidden = !addPanelOpen/);
});

test("P1008 shopping first table reuses the service table structure", () => {
  assert.match(tablesSource, /p1008-card p1008-services-card p1008-shopping-items-card/);
  assert.match(tablesSource, /p1008-shopping-table p1008-services-table p1008-shopping-service-table/);
  assert.match(tablesSource, /\["Hạng mục", "Tiền", "Chia cho", "Mỗi người"\]/);
  assert.match(tablesSource, /classList\.add\("p1008-amount-field"\)/);
  assert.match(tablesSource, /row\.cells\[3\]\?\.classList\.add\("p1008-per-person"\)/);
  assert.match(tablesStyles, /width: min\(720px, 100%\) !important/);
  assert.match(tablesStyles, /width: 132px/);
  assert.match(tablesStyles, /grid-template-columns: minmax\(0, 1fr\) 20px/);
});

test("P1008 shopping second table reuses the service member table structure", () => {
  assert.match(tablesSource, /p1008-card p1008-people-card p1008-shopping-people-card/);
  assert.match(tablesSource, /p1008-people-table p1008-shopping-people-table/);
  assert.match(tablesSource, /<th>Thành viên<\/th>/);
  assert.match(tablesSource, /<th>Tổng đóng<\/th>/);
  for (const person of ["A Mạnh", "A Cường", "Vanh", "Dương", "Hưng", "Trung"]) {
    assert.match(tablesSource, new RegExp(person));
  }
  assert.match(tablesStyles, /width: min\(930px, 100%\) !important/);
  assert.match(tablesStyles, /width: max-content !important/);
});

test("P1008 shopping member table preserves the 6, 5 and 4 person rules", () => {
  assert.match(tablesSource, /Number\(splitCount\) === 5[\s\S]*person !== "Hưng"/);
  assert.match(tablesSource, /Number\(splitCount\) === 4[\s\S]*person !== "Hưng" && person !== "A Mạnh"/);
  assert.match(tablesSource, /Math\.floor\(amount \/ eligible\.length\)/);
  assert.match(tablesSource, /people\[person\]\.items\[item\.id\] = share/);
  assert.match(tablesSource, /value === null[\s\S]*p1008-not-applicable/);
});

test("shopping refinement removes the separate shopping summary", () => {
  assert.match(tablesSource, /summary\?\.remove\(\)/);
  assert.doesNotMatch(tablesSource, /updateShoppingSummary/);
  assert.match(tablesStyles, /\.p1008-shopping-summary[\s\S]*display: none !important/);
});

test("canonical build emits final service-matched shopping assets directly", () => {
  const baseScript = "finance-p1008-shopping-v1.js?v=joy-finance-p1008-shopping-v1";
  const tablesScript = "finance-p1008-shopping-tables-v1.js?v=joy-finance-p1008-shopping-tables-v3";
  assert.match(buildSource, /finance-p1008-shopping-tables-v1\.css\?v=joy-finance-p1008-shopping-tables-v3/);
  assert.match(buildSource, /finance-p1008-shopping-tables-v1\.js\?v=joy-finance-p1008-shopping-tables-v3/);
  assert.ok(buildSource.indexOf(baseScript) < buildSource.indexOf(tablesScript));
});