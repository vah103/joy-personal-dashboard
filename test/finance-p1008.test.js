import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../project-data/finance/finance-p1008.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../project-data/finance/finance-p1008.css", import.meta.url), "utf8");
const amountInputSource = await readFile(new URL("../project-data/finance/finance-p1008-amount-input-v1.js", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8");
const packageSource = await readFile(new URL("../package.json", import.meta.url), "utf8");
const buildSource = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("P1008 source parses and is loaded by the dashboard", () => {
  assert.doesNotThrow(() => new Function(source));
  assert.doesNotThrow(() => new Function(amountInputSource));
  assert.match(dashboard, /project-data\/finance\/finance-p1008\.css/);
  assert.match(dashboard, /project-data\/finance\/finance-p1008\.js/);
});

test("P1008 includes all six room members and five service types", () => {
  for (const person of ["A Mạnh", "A Cường", "Vanh", "Dương", "Hưng", "Trung"]) assert.match(source, new RegExp(person));
  for (const service of ["Dịch vụ căn hộ", "Điện", "Nước sinh hoạt", "Phí gửi xe", "Wi‑Fi"]) assert.match(source, new RegExp(service));
});

test("P1008 applies the July exception only to electricity, water and Wi-Fi", () => {
  assert.match(source, /apartment[\s\S]*julyIncludesTrung: true/);
  assert.match(source, /electricity[\s\S]*julyIncludesTrung: false/);
  assert.match(source, /water[\s\S]*julyIncludesTrung: false/);
  assert.match(source, /parking[\s\S]*julyIncludesTrung: true/);
  assert.match(source, /wifi[\s\S]*julyIncludesTrung: false/);
  assert.match(source, /person !== "Trung"/);
});

test("P1008 provides the shopping card that the monthly shopping module enhances", () => {
  assert.match(source, /p1008-shopping-card/);
  assert.match(source, /Chia tiền mua sắm/);
  assert.match(buildSource, /finance-p1008-shopping-v1\.css/);
  assert.match(buildSource, /finance-p1008-shopping-v1\.js/);
});

test("P1008 uses OpenAI Sans headings and Nunito body text", () => {
  assert.match(styles, /font-family: "Nunito"/);
  assert.match(styles, /font-family: "OpenAI Sans"/);
  assert.match(styles, /\.p1008-view h2,/);
  assert.match(styles, /\.p1008-view h3,/);
});

test("P1008 service table is compact and removes row notes", () => {
  assert.match(source, /<h3>Tiền dịch vụ<\/h3>/);
  assert.match(source, /<th>Hạng mục<\/th><th>Tiền<\/th><th>Chia cho<\/th><th>Mỗi người<\/th>/);
  assert.match(source, /class="p1008-share-count">\$\{eligible\.length\}<\/td>/);
  assert.doesNotMatch(source, /eligible\.join\(" · "\)/);
  assert.doesNotMatch(source, /xấp xỉ, chênh tối đa 1 ₫/);
  assert.match(styles, /\.p1008-services-card \{/);
  assert.match(styles, /width: min\(860px, 100%\)/);
});

test("P1008 amount entry stays stable while typing and supports thousand shorthand", () => {
  assert.match(amountInputSource, /\[data-p1008-service\]/);
  assert.match(amountInputSource, /\[data-shopping-amount\]/);
  assert.match(amountInputSource, /\[data-shopping-new-amount\]/);
  assert.match(amountInputSource, /event\.stopImmediatePropagation\(\)/);
  assert.match(amountInputSource, /amountCore\.parse\(text\)/);
  assert.match(amountInputSource, /amountCore\.inputValue\(value\)/);
  assert.match(amountInputSource, /570 = 570\.000/);
});

test("P1008 syncs local data through the signed-in account API", () => {
  assert.match(source, /const API_PATH = "\/api\/p1008"/);
  assert.match(source, /credentials: "same-origin"/);
  assert.match(source, /method: "PUT"/);
  assert.match(source, /mergeCloudWithLocal/);
  assert.match(source, /localMutationVersion/);
  assert.match(source, /Đã đồng bộ tài khoản/);
  assert.match(source, /Chưa đồng bộ · lưu tạm trên máy/);
  assert.match(source, /window\.addEventListener\("focus"/);
  assert.match(source, /joy:p1008-rendered/);
});

test("P1008 overview uses larger readable typography", () => {
  assert.match(styles, /\.p1008-summary strong \{[\s\S]*font-size: 29px/);
  assert.match(styles, /\.p1008-summary span \{[\s\S]*font-size: 11px/);
  assert.match(styles, /\.p1008-card table \{[\s\S]*font-size: 11px/);
});

test("P1008 production assets are emitted directly by the canonical build", () => {
  assert.match(buildSource, /replaceAll\('joy-finance-p1008-v1', 'joy-finance-p1008-v4'\)/);
  assert.match(buildSource, /finance-p1008-refine-v3\.css\?v=joy-finance-p1008-refine-v7/);
  assert.match(buildSource, /finance-p1008-refine-v3\.js\?v=joy-finance-p1008-refine-v7/);
  assert.match(buildSource, /finance-p1008-capture-v2\.css\?v=joy-finance-p1008-capture-v3/);
  assert.match(buildSource, /finance-p1008-shopping-v1\.css\?v=joy-finance-p1008-shopping-v1/);
  assert.match(buildSource, /finance-p1008-shopping-v1\.js\?v=joy-finance-p1008-shopping-v1/);
  assert.match(buildSource, /finance-p1008-amount-input-v1\.js\?v=joy-finance-p1008-amount-input-v1/);
  assert.doesNotMatch(packageSource, /cache-bust-finance-p1008\.mjs/);
});
