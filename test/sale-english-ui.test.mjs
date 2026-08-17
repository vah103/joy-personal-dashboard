import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { saleText } from "../src/features/sales/shared/i18n.js";

globalThis.JoyI18n = {
  t(key, values = {}) {
    if (key === "sale.test") return `Semantic ${values.value}`;
    return key;
  },
};

test("Sale language adapter resolves semantic keys through shared JoyI18n", () => {
  assert.equal(saleText("sale.test", "Fallback", { value: "copy" }), "Semantic copy");
  assert.equal(saleText("sale.missing", "Fallback"), "Fallback");
});

test("Sale adapter translates only explicit semantic bindings", async () => {
  const source = await readFile(new URL("../src/features/sales/shared/i18n.js", import.meta.url), "utf8");
  assert.match(source, /JoyI18n/);
  assert.match(source, /\/i18n\/index\.js/);
  assert.match(source, /data-i18n-placeholder/);
  assert.match(source, /data-i18n-aria-label/);
  assert.match(source, /i18n\.t\?\.\(key\)/);
  assert.doesNotMatch(source, /\.translateText\b/);
  assert.doesNotMatch(source, /\.translateRoot\b/);
  assert.doesNotMatch(source, /EXACT_TEXT|ENGLISH_MONTHS/);
});

test("Sale static views declare semantic translation keys", async () => {
  const [assistant, salePage] = await Promise.all([
    readFile(new URL("../src/features/sales/assistant/assistant-view.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8"),
  ]);
  assert.match(assistant, /data-i18n="saleAssistant\.appointments"/);
  assert.match(assistant, /data-i18n-placeholder="saleAssistant\.appointmentPlaceholder"/);
  assert.match(assistant, /data-i18n-aria-label="saleAssistant\.toolsAria"/);
  assert.match(salePage, /data-i18n="salePage\.workspace"/);
  assert.match(salePage, /data-i18n-placeholder="salePage\.searchPlaceholder"/);
  assert.match(salePage, /data-i18n-aria-label="salePage\.navAria"/);
});

test("Sale dynamic UI uses semantic keys instead of post-render text translation", async () => {
  const [renderer, manager] = await Promise.all([
    readFile(new URL("../src/features/sales/room-summary/renderer.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/manager/sale-manager.js", import.meta.url), "utf8"),
  ]);
  assert.match(renderer, /SERVICE_I18N_KEYS/);
  assert.match(renderer, /saleAssistant\.electricity/);
  assert.doesNotMatch(renderer, /translateSaleUiRoot/);
  assert.match(manager, /salePage\.monthDeals/);
  assert.match(manager, /salePage\.month\$\{monthNumber\}/);
  assert.doesNotMatch(manager, /translateSaleUiRoot/);
});

test("build keeps the Sale adapter while shared i18n preserves one canonical HTML owner", async () => {
  const [build, i18nBuild, bootstrap, salePage, adapter, history] = await Promise.all([
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-i18n.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/app-bootstrap.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/shared/i18n.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
  ]);

  assert.match(build, /resolve\(saleSharedFeature, "i18n\.js"\)/);
  assert.match(build, /sale-english-ui\.js/);
  assert.match(i18nBuild, /cp\(source, target/);
  assert.doesNotMatch(i18nBuild, /writeFile|inject\(/);
  assert.match(adapter, /\/i18n\/index\.js/);
  assert.match(bootstrap, /sale-english-ui\.js\?v=joy-sale-english-ui-v1/);
  assert.match(salePage, /sale-english-ui\.js\?v=joy-sale-english-ui-v1/);
  assert.match(history, /Delete the appointment for/);
  assert.match(history, /Close deal/);
});
