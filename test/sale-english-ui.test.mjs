import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { translateText } from "../src/i18n/index.js";
import { translateSaleUiText } from "../src/features/sales/sale-english-ui.js";

globalThis.JoyI18n = { translateText };

test("Sale language adapter delegates generic Sale copy to shared JoyI18n", () => {
  assert.equal(translateSaleUiText("Tóm tắt phòng"), "Room summary");
  assert.equal(translateSaleUiText("Lịch sử"), "History");
  assert.equal(translateSaleUiText("Đang lưu lịch vào Joy…"), "Saving appointment to Joy…");
});

test("shared i18n handles Sale dynamic room and date chrome", () => {
  assert.equal(translateSaleUiText("4 lịch hẹn"), "4 appointments");
  assert.equal(translateSaleUiText("Th 3, 11/08/2026 · 20:03"), "Tue, 11 Aug 2026 · 20:03");
  assert.equal(translateSaleUiText("14 phòng · Trống từ 1/9", "en"), "14 rooms · Available from 1/9");
  assert.equal(translateSaleUiText("P201, P202 (trống 1/9)"), "P201, P202 (available from 1/9)");
  assert.equal(translateSaleUiText("35k/m"), "35k/m");
});

test("Sale adapter no longer owns a private translation dictionary", async () => {
  const source = await readFile(new URL("../src/features/sales/sale-english-ui.js", import.meta.url), "utf8");
  assert.match(source, /JoyI18n/);
  assert.match(source, /\/i18n\/index\.js/);
  assert.doesNotMatch(source, /EXACT_TEXT/);
  assert.doesNotMatch(source, /ENGLISH_MONTHS/);
});

test("Sale Assistant directly owns its locale-aware copy", async () => {
  const assistant = await readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8");
  assert.match(assistant, /import \{ t, translateText \} from "\/i18n\/index\.js\?v=joy-i18n-v1"/);
  assert.match(assistant, /assistantHtml\(\)/);
  assert.match(assistant, /t\("saleAssistant\.appointments"\)/);
  assert.match(assistant, /t\("saleAssistant\.roomSummary"\)/);
  assert.match(assistant, /t\("saleAssistant\.history"\)/);
  assert.match(assistant, /translateText\(formatVietnamViewingTime\(value\)\)/);
  assert.doesNotMatch(assistant, /const ASSISTANT_HTML/);
});

test("build keeps the generic Sale adapter while shared i18n preserves one canonical HTML owner", async () => {
  const [build, i18nBuild, bootstrap, salePage, adapter, history] = await Promise.all([
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-i18n.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/app-bootstrap.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sale-english-ui.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sale-history-row-edit.js", import.meta.url), "utf8"),
  ]);

  assert.match(build, /sale-english-ui\.js/);
  assert.match(i18nBuild, /cp\(source, target/);
  assert.doesNotMatch(i18nBuild, /writeFile|inject\(/);
  assert.match(adapter, /\/i18n\/index\.js/);
  assert.match(bootstrap, /sale-english-ui\.js\?v=joy-sale-english-ui-v1/);
  assert.match(salePage, /sale-english-ui\.js\?v=joy-sale-english-ui-v1/);
  assert.match(history, /Delete the appointment for/);
  assert.match(history, /Close deal/);
});
