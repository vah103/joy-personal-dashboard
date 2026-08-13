import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_LOCALE,
  getLocale,
  t,
  translateText,
  validateLocaleParity,
} from "../src/i18n/index.js";

test("Joy i18n defaults to English and exposes Vietnamese from the same semantic keys", () => {
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(getLocale(), "en");
  assert.equal(t("settings.title", {}, "en"), "Settings");
  assert.equal(t("settings.title", {}, "vi"), "Cài đặt");
  assert.equal(t("projects.currentFocus", {}, "vi"), "Trọng tâm hiện tại");
});

test("English and Vietnamese locale dictionaries stay structurally identical", () => {
  assert.deepEqual(validateLocaleParity(), {
    missingInVi: [],
    missingInEn: [],
    placeholderMismatches: [],
  });
});

test("legacy visible Sale copy is translated centrally while source facts stay untouched", () => {
  assert.equal(translateText("Tóm tắt phòng", "en"), "Room summary");
  assert.equal(translateText("Room summary", "vi"), "Tóm tắt phòng");
  assert.equal(translateText("14 phòng · Trống từ 1/9", "en"), "14 rooms · Available from 1/9");
  assert.equal(translateText("35k/m", "vi"), "35k/m");
  assert.equal(translateText("59 Dương Khuê", "en"), "59 Dương Khuê");
});

test("build stage injects one shared language runtime into every top-level page", async () => {
  const source = await readFile(new URL("../scripts/build-i18n.mjs", import.meta.url), "utf8");
  assert.match(source, /inject\("index\.html"\)/);
  assert.match(source, /inject\("login\.html"\)/);
  assert.match(source, /inject\("sale-manager\.html"\)/);
  assert.match(source, /\/i18n\/index\.js/);
});

test("i18n rules are enforced by verify", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts.verify, /i18n:check/);
  assert.match(packageJson.scripts.build, /build-i18n\.mjs/);
});
