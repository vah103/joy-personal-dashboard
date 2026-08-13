import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { translateSaleUiText } from "../src/features/sales/sale-english-ui.js";

test("translates core Sale Assistant controls to English", () => {
  assert.equal(translateSaleUiText("Hẹn khách xem phòng"), "Schedule a room viewing");
  assert.equal(translateSaleUiText("Tóm tắt phòng"), "Room summary");
  assert.equal(translateSaleUiText("Lịch sử"), "History");
  assert.equal(translateSaleUiText("Đang lưu lịch vào Joy…"), "Saving appointment to Joy…");
});

test("translates dynamic viewing history text and date chrome", () => {
  assert.equal(translateSaleUiText("1 lịch hẹn"), "1 appointment");
  assert.equal(translateSaleUiText("4 lịch hẹn"), "4 appointments");
  assert.equal(translateSaleUiText("Th 3, 11/08/2026 · 20:03"), "Tue, 11 Aug 2026 · 20:03");
  assert.equal(
    translateSaleUiText("Chưa nhận ra tên khách, địa chỉ. Bạn có thể điền trực tiếp bên dưới."),
    "Could not recognize customer name, address. You can fill it in below.",
  );
});

test("translates generated Room Summary labels without translating source facts", () => {
  assert.equal(translateSaleUiText("Phòng trống"), "Available rooms");
  assert.equal(translateSaleUiText("Giá phòng"), "Room prices");
  assert.equal(translateSaleUiText("Dịch vụ chung"), "Common services");
  assert.equal(translateSaleUiText("14 phòng · Trống từ 1/9"), "14 rooms · Available from 1/9");
  assert.equal(translateSaleUiText("P201, P202 (trống 1/9)"), "P201, P202 (available from 1/9)");
  assert.equal(translateSaleUiText("35k/m"), "35k/m");
});

test("Sale English installer covers every Sale scope while preserving history customer data", async () => {
  const source = await readFile(new URL("../src/features/sales/sale-english-ui.js", import.meta.url), "utf8");
  assert.match(source, /querySelectorAll\?\.\(SALE_SCOPE_SELECTOR\)/);
  assert.match(source, /index === 0 \|\| index >= 4/);
  assert.doesNotMatch(source, /historyNodeReady/);
});

test("build ships the Sale English UI and dashboard loads it", async () => {
  const [build, bootstrap, salePage, history] = await Promise.all([
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/app-bootstrap.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sale-history-row-edit.js", import.meta.url), "utf8"),
  ]);

  assert.match(build, /sale-english-ui\.js/);
  assert.match(bootstrap, /sale-english-ui\.js\?v=joy-sale-english-ui-v1/);
  assert.match(bootstrap, /AI is polishing the text/);
  assert.match(salePage, /sale-english-ui\.js\?v=joy-sale-english-ui-v1/);
  assert.match(history, /Delete the appointment for/);
  assert.match(history, /Close deal/);
});
