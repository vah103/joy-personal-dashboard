import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import en from "../src/i18n/locales/en.js";
import vi from "../src/i18n/locales/vi.js";
import { findUntranslatedUiLiterals } from "./i18n-ui-literal-guard.mjs";

const root = resolve(import.meta.dirname, "..");
const sourceRoots = [resolve(root, "src"), resolve(root, "project-data")];
const translatedValues = new Set(Object.values(en).concat(Object.values(vi)).map((value) => String(value).trim()));
const LEGACY_BASELINE_CEILING = 55;
const baselineEntries = JSON.parse(await readFile(resolve(import.meta.dirname, "i18n-hardcoded-ui-baseline.json"), "utf8"));
const legacyBaseline = new Set(baselineEntries);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (/\.(?:js|mjs)$/u.test(entry.name)) files.push(path);
  }
  return files;
}

function findingKey(file, finding) {
  return `${relative(root, file).replaceAll("\\", "/")}|${finding.sink}|${finding.value}`;
}

const errors = [];
if (!Array.isArray(baselineEntries)) errors.push("i18n hard-code baseline must be a JSON array");
if (legacyBaseline.size !== baselineEntries.length) errors.push("i18n hard-code baseline contains duplicate entries");
if (legacyBaseline.size > LEGACY_BASELINE_CEILING) {
  errors.push(`legacy hard-code baseline grew from its ceiling of ${LEGACY_BASELINE_CEILING}; migrate the new UI copy to JoyI18n instead`);
}

const files = (await Promise.all(sourceRoots.map((directory) => walk(directory)))).flat();
const observedLegacy = new Set();
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const finding of findUntranslatedUiLiterals(source, translatedValues)) {
    const key = findingKey(file, finding);
    if (legacyBaseline.has(key)) {
      observedLegacy.add(key);
      continue;
    }
    errors.push(`${relative(root, file)}:${finding.line} hard-codes new UI copy in ${finding.sink}: ${JSON.stringify(finding.value)}`);
  }
}

if (errors.length) {
  console.error("Joy hard-coded UI check failed:\n" + errors.map((line) => `- ${line}`).join("\n"));
  console.error("Use JoyI18n.t(\"semantic.key\") / data-i18n and add matching EN/VI keys. Do not expand the frozen legacy baseline for new UI.");
  process.exit(1);
}

const staleLegacy = [...legacyBaseline].filter((entry) => !observedLegacy.has(entry));
if (staleLegacy.length) {
  console.log(`Joy i18n note: ${staleLegacy.length} legacy hard-code baseline entr${staleLegacy.length === 1 ? "y is" : "ies are"} no longer observed and can be removed.`);
}
console.log(`Joy hard-coded UI check passed: ${files.length} JS modules scanned; ${legacyBaseline.size} frozen legacy exceptions, no new untranslated UI sinks`);
