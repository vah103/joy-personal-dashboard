import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import en from "../src/i18n/locales/en.js";
import vi from "../src/i18n/locales/vi.js";
import {
  findUntranslatedHtmlLiterals,
  findUntranslatedUiLiterals,
} from "./i18n-ui-literal-guard.mjs";

const root = resolve(import.meta.dirname, "..");
const sourceRoots = [resolve(root, "src"), resolve(root, "project-data")];
const translatedValues = new Set(Object.values(en).concat(Object.values(vi)).map((value) => String(value).trim()));
const LEGACY_BASELINE_CEILING = 0;
const baselineEntries = JSON.parse(await readFile(resolve(import.meta.dirname, "i18n-hardcoded-ui-baseline.json"), "utf8"));
const legacyBaseline = new Set(baselineEntries);

// HTML-template auditing is intentionally scoped to interface-owned surfaces.
// Project narratives, user content, source listings and learning content are data,
// not UI chrome, and must not be translated by this guard.
const DYNAMIC_HTML_AUDIT = new Set([
  "src/features/auth/auth-ui.js",
  "src/features/finance/finance-month-layout.js",
  "src/features/finance/finance.js",
  "src/features/ielts/core-actions.js",
  "src/features/ielts/course-prompt-bridge.js",
  "src/features/ielts/course-sync.js",
  "src/features/project-hub/project-hub-core.js",
  "src/features/project-hub/project-hub-render.js",
  "src/features/sales/sales-assistant.js",
  "src/features/tasks/task-reminders.js",
  "src/features/weather/weather-rain.js",
  "src/pages/dashboard/app-communication.js",
  "src/pages/sale/room-summary.js",
  "project-data/finance/finance-p1008-shopping-tables-v1.js",
  "project-data/finance/finance-p1008-shopping-v1.js",
  "project-data/finance/finance-p1008.js",
  "project-data/speaking/speaking.js",
  "project-data/vocabulary/vocabulary-compact.js",
  "project-data/vocabulary/vocabulary.js",
]);

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
  errors.push("legacy hard-code baseline must remain empty; migrate UI copy to shared JoyI18n instead");
}

const files = (await Promise.all(sourceRoots.map((directory) => walk(directory)))).flat();
const observedLegacy = new Set();
for (const file of files) {
  const source = await readFile(file, "utf8");
  const repoPath = relative(root, file).replaceAll("\\", "/");
  const findings = [
    ...findUntranslatedUiLiterals(source, translatedValues),
    ...(DYNAMIC_HTML_AUDIT.has(repoPath) ? findUntranslatedHtmlLiterals(source, translatedValues) : []),
  ];

  for (const finding of findings) {
    const key = findingKey(file, finding);
    if (legacyBaseline.has(key)) {
      observedLegacy.add(key);
      continue;
    }
    errors.push(`${repoPath}:${finding.line} hard-codes untranslated UI copy in ${finding.sink}: ${JSON.stringify(finding.value)}`);
  }
}

if (errors.length) {
  console.error("Joy hard-coded UI check failed:\n" + errors.map((line) => `- ${line}`).join("\n"));
  console.error("Use JoyI18n.t(\"semantic.key\") / data-i18n or add the exact EN/VI pair to the shared locale catalog. The legacy baseline must stay empty.");
  process.exit(1);
}

const staleLegacy = [...legacyBaseline].filter((entry) => !observedLegacy.has(entry));
if (staleLegacy.length) {
  console.error("Joy hard-coded UI check failed: the zero-baseline file contains stale entries.");
  process.exit(1);
}
console.log(`Joy hard-coded UI check passed: ${files.length} JS modules scanned; zero legacy exceptions; ${DYNAMIC_HTML_AUDIT.size} dynamic HTML surfaces audited`);
