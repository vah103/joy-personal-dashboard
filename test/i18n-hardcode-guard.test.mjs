import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import en from "../src/i18n/locales/en.js";
import vi from "../src/i18n/locales/vi.js";
import { findUntranslatedUiLiterals } from "../scripts/i18n-ui-literal-guard.mjs";

const translatedValues = new Set(Object.values(en).concat(Object.values(vi)));

test("hard-coded UI guard rejects new literal interface copy", () => {
  const source = `
    button.textContent = "Brand new untranslated action";
    input.setAttribute("aria-label", "Brand new untranslated label");
  `;
  const findings = findUntranslatedUiLiterals(source, translatedValues);
  assert.deepEqual(findings.map((item) => item.value), [
    "Brand new untranslated action",
    "Brand new untranslated label",
  ]);
});

test("hard-coded UI guard accepts shared catalog copy and dynamic user data", () => {
  const source = `
    button.textContent = "Save transaction";
    note.textContent = userProvidedNote;
    marker.textContent = "—";
  `;
  assert.deepEqual(findUntranslatedUiLiterals(source, translatedValues), []);
});

test("canonical i18n command includes the hard-coded UI scanner", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["i18n:check"], /check-i18n-v2\.mjs/);
  assert.match(packageJson.scripts["i18n:check"], /check-i18n-hardcoded-ui\.mjs/);
  assert.match(packageJson.scripts.test, /npm run i18n:check/);
});
