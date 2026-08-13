import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_LOCALE,
  LOCALES,
  getLocale,
  t,
  translateText,
} from "../src/i18n/index.js";

test("Joy i18n defaults to English and exposes Vietnamese from the same semantic keys", () => {
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(getLocale(), "en");
  assert.equal(t("settings.title", {}, "en"), "Settings");
  assert.equal(t("settings.title", {}, "vi"), "Cài đặt");
  assert.equal(t("projects.currentFocus", {}, "vi"), "Trọng tâm hiện tại");
});

test("English and Vietnamese locale dictionaries keep identical semantic keys", () => {
  assert.deepEqual(Object.keys(LOCALES.en).sort(), Object.keys(LOCALES.vi).sort());
});

test("legacy visible Sale copy is translated centrally while source facts stay untouched", () => {
  assert.equal(translateText("Tóm tắt phòng", "en"), "Room summary");
  assert.equal(translateText("Room summary", "vi"), "Tóm tắt phòng");
  assert.equal(translateText("14 phòng · Trống từ 1/9", "en"), "14 rooms · Available from 1/9");
  assert.equal(translateText("35k/m", "vi"), "35k/m");
  assert.equal(translateText("59 Dương Khuê", "en"), "59 Dương Khuê");
});

test("shared i18n assets are copied without creating a second HTML owner", async () => {
  const [buildStage, saleAdapter, login] = await Promise.all([
    readFile(new URL("../scripts/build-i18n.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sale-english-ui.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/login/index.html", import.meta.url), "utf8"),
  ]);
  assert.match(buildStage, /cp\(source, target/);
  assert.doesNotMatch(buildStage, /writeFile|inject\(/);
  assert.match(saleAdapter, /\/i18n\/index\.js/);
  assert.match(login, /\/i18n\/index\.js/);
});

test("i18n observer cannot observe the DOM writes produced by translation itself", async () => {
  const runtime = await readFile(new URL("../src/i18n/index.js", import.meta.url), "utf8");
  assert.match(runtime, /function pauseObserver\(\)[\s\S]*observer\.disconnect\(\)/);
  assert.match(runtime, /const reconnect = pauseObserver\(\);[\s\S]*finally[\s\S]*connectObserver\(\)/);
  assert.match(runtime, /if \(root\.nodeType === 9\) applyLocaleSpecificFormatting\(document\)/);
  assert.match(runtime, /if \(element\.textContent !== translated\) element\.textContent = translated/);
});

test("i18n rules run inside the existing canonical verification path", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts.test, /check-i18n-v2\.mjs/);
  assert.match(packageJson.scripts.build, /build-i18n\.mjs/);
  assert.equal(packageJson.scripts.verify, "npm run audit:prod && npm run audit:all && npm run db:migrate:smoke && npm test && npm run build");
});
