import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../project-data/finance/finance-p1008.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../project-data/finance/finance-p1008.css", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8");

test("P1008 source parses and is loaded by the dashboard", () => {
  assert.doesNotThrow(() => new Function(source));
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

test("P1008 keeps shopping pending until the monthly day-15 close", () => {
  assert.match(source, /Chia tiền mua sắm/);
  assert.match(source, /ngày 15 hằng tháng/);
  assert.match(source, /Chờ cập nhật/);
});

test("P1008 uses OpenAI Sans headings and Nunito body text", () => {
  assert.match(styles, /font-family:"Nunito"/);
  assert.match(styles, /font-family:"OpenAI Sans"/);
  assert.match(styles, /\.p1008-view h2,\.p1008-view h3/);
});
