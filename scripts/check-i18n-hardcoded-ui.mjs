import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import en from "../src/i18n/locales/en.js";
import vi from "../src/i18n/locales/vi.js";
import { findUntranslatedUiLiterals } from "./i18n-ui-literal-guard.mjs";

const root = resolve(import.meta.dirname, "..");
const sourceRoots = [resolve(root, "src"), resolve(root, "project-data")];
const translatedValues = new Set(Object.values(en).concat(Object.values(vi)).map((value) => String(value).trim()));

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

const errors = [];
const files = (await Promise.all(sourceRoots.map((directory) => walk(directory)))).flat();
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const finding of findUntranslatedUiLiterals(source, translatedValues)) {
    errors.push(`${relative(root, file)}:${finding.line} hard-codes UI copy in ${finding.sink}: ${JSON.stringify(finding.value)}`);
  }
}

if (errors.length) {
  console.error("Joy hard-coded UI check failed:\n" + errors.map((line) => `- ${line}`).join("\n"));
  console.error("Use JoyI18n.t(\"semantic.key\") / data-i18n and add matching EN/VI keys. Keep user-entered/source data out of this guard.");
  process.exit(1);
}

console.log(`Joy hard-coded UI check passed: ${files.length} JS modules scanned against shared EN/VI catalog`);
