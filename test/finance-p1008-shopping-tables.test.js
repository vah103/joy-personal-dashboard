import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tablesSource = await readFile(new URL("../project-data/finance/finance-p1008-shopping-tables-v1.js", import.meta.url), "utf8");
const tablesStyles = await readFile(new URL("../project-data/finance/finance-p1008-shopping-tables-v1.css", import.meta.url), "utf8");
const shoppingSource = await readFile(new URL("../project-data/finance/finance-p1008-shopping-v1.js", import.meta.url), "utf8");
const buildSource = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("P1008 shopping keeps manual item entry in the first table", () => {
  assert.doesNotThrow(() => new Function(tablesSource));
  assert.match(shoppingSource, /data-shopping-new-name/);
  assert.match(shoppingSource, /data-shopping-new-amount/);
  assert.match(shoppingSource, /data-shopping-new-split/);
  assert.match(shoppingSource, /p1008-shopping-table/);
  assert.match(tablesSource, /makeCardHeader\("Tiền mua đồ chung", "Nhập tay từng món"\)/);
  assert.match(tablesSource, /p1008-shopping-items-card/);
});

test("P1008 shopping renders a second member-by-item table like service splitting", () => {
  assert.match(tablesSource, /makeCardHeader\("Chia tiền mua đồ chung", monthLabel\)/);
  assert.match(tablesSource, /p1008-shopping-people-table/);
  assert.match(tablesSource, /<th>Thành viên<\/th>/);
  assert.match(tablesSource, /items\.map\(\(item\) => `<th>\$\{escapeHtml\(item\.name\)\}<\/th>`\)/);
  assert.match(tablesSource, /<th>Tổng đóng<\/th>/);
  for (const person of ["A Mạnh", "A Cường", "Vanh", "Dương", "Hưng", "Trung"]) {
    assert.match(tablesSource, new RegExp(person));
  }
});

test("P1008 shopping member table preserves the 6, 5 and 4 person rules", () => {
  assert.match(tablesSource, /Number\(splitCount\) === 5[\s\S]*person !== "Hưng"/);
  assert.match(tablesSource, /Number\(splitCount\) === 4[\s\S]*person !== "Hưng" && person !== "A Mạnh"/);
  assert.match(tablesSource, /Math\.floor\(amount \/ eligible\.length\)/);
  assert.match(tablesSource, /people\[person\]\.items\[item\.id\] = share/);
  assert.match(tablesSource, /people\[person\]\.total \+= share/);
  assert.match(tablesSource, /value === null[\s\S]*p1008-not-applicable/);
});

test("P1008 shopping two-table layout matches the service table card language", () => {
  assert.match(tablesStyles, /font-family: "Nunito"/);
  assert.match(tablesStyles, /\.p1008-shopping-table-layout/);
  assert.match(tablesStyles, /\.p1008-shopping-table-layout > \.p1008-card/);
  assert.match(tablesStyles, /\.p1008-shopping-people-table/);
  assert.match(tablesStyles, /position: sticky/);
  assert.match(tablesStyles, /tr\.is-vanh/);
  assert.match(tablesStyles, /overflow: auto/);
});

test("canonical build loads the two-table refinement after the shopping module", () => {
  const baseScript = "finance-p1008-shopping-v1.js?v=joy-finance-p1008-shopping-v1";
  const tablesScript = "finance-p1008-shopping-tables-v1.js?v=joy-finance-p1008-shopping-tables-v1";
  assert.match(buildSource, /finance-p1008-shopping-tables-v1\.css\?v=joy-finance-p1008-shopping-tables-v1/);
  assert.match(buildSource, /finance-p1008-shopping-tables-v1\.js\?v=joy-finance-p1008-shopping-tables-v1/);
  assert.ok(buildSource.indexOf(baseScript) < buildSource.indexOf(tablesScript));
});
