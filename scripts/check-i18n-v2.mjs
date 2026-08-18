import { readdir, readFile, stat } from "node:fs/promises";
import { basename, resolve, relative } from "node:path";
import en from "../src/i18n/locales/en.js";
import vi from "../src/i18n/locales/vi.js";

const root = resolve(import.meta.dirname, "..");
const sourceRoots = [resolve(root, "src"), resolve(root, "project-data")];
const dictionaries = { en, vi };
const supported = Object.keys(dictionaries);
const ICU_PLURAL = /\{([a-zA-Z0-9_]+),\s*plural,\s*one\s*\{[^{}]*\}\s*other\s*\{[^{}]*\}\}/g;

function placeholders(value) {
  const pluralKeys = [];
  const normalized = String(value).replace(ICU_PLURAL, (_match, key) => {
    pluralKeys.push(key);
    return "";
  });
  return [...new Set([
    ...pluralKeys,
    ...[...normalized.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]),
  ])].sort();
}

function fail(lines) {
  console.error("Joy i18n check failed:\n" + lines.map((line) => `- ${line}`).join("\n"));
  process.exit(1);
}

const errors = [];
const allKeys = new Set(Object.keys(en));
for (const locale of supported) Object.keys(dictionaries[locale]).forEach((key) => allKeys.add(key));

for (const key of [...allKeys].sort()) {
  for (const locale of supported) {
    if (!Object.prototype.hasOwnProperty.call(dictionaries[locale], key)) {
      errors.push(`${locale}.js is missing key ${key}`);
      continue;
    }
    if (!String(dictionaries[locale][key]).trim()) errors.push(`${locale}.js has an empty value for ${key}`);
  }
  if (Object.prototype.hasOwnProperty.call(en, key) && Object.prototype.hasOwnProperty.call(vi, key)) {
    const enPlaceholders = JSON.stringify(placeholders(en[key]));
    const viPlaceholders = JSON.stringify(placeholders(vi[key]));
    if (enPlaceholders !== viPlaceholders) {
      errors.push(`Placeholder mismatch for ${key}: en=${enPlaceholders} vi=${viPlaceholders}`);
    }
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (/\.(?:js|mjs|html)$/u.test(entry.name)) files.push(path);
  }
  return files;
}

const files = (await Promise.all(sourceRoots.map((directory) => walk(directory)))).flat();
const literalKeyPatterns = [
  /JoyI18n\.t\(\s*["'`]([^"'`]+)["'`]/g,
  /data-i18n=["']([^"']+)["']/g,
];

for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const pattern of literalKeyPatterns) {
    for (const match of source.matchAll(pattern)) {
      if (!allKeys.has(match[1])) errors.push(`${relative(root, file)} references unknown i18n key ${match[1]}`);
    }
  }

  const name = basename(file).toLowerCase();
  const legacyAdapter = relative(root, file).replaceAll("\\", "/");
  const allowedLegacy = new Set([
    "src/features/sales/sale-english-ui.js",
    "src/features/project-details/turtlebot-roadmap-language.js",
    "src/features/tasks/task-english.js",
  ]);
  if ((name.includes("english-ui") || name.includes("vietnamese-ui") || name.includes("-language")) && !allowedLegacy.has(legacyAdapter)) {
    errors.push(`${legacyAdapter} looks like a new feature-specific language layer; use shared JoyI18n instead`);
  }
}

const auditedSurfaceCopy = [
  ["project-data/finance/finance-p1008.js", ["Chia tiền nhà", "Tổng dịch vụ", "Đang đồng bộ…"]],
  ["project-data/finance/finance-p1008-shopping-v1.js", ["Không tính Hưng", "Đủ 6 người"]],
  ["project-data/vocabulary/vocabulary.js", ["Vocabulary", "Show answer", "Correct ✓"]],
  ["project-data/speaking/speaking.js", ["How do I say this?", "Make it English", "Try another"]],
  ["src/features/finance/finance.js", ["Actual balance", "Monthly finance", "Save transaction"]],
  ["src/features/project-hub/project-hub-render.js", ["Overall progress", "Completion gate", "Recommended next action"]],
  ["src/features/sales/manager/manager.js", ["No matching deals in this month.", "Edit closed room", "Saving…"]],
];
const translatedValues = new Set(Object.values(en).concat(Object.values(vi)));
for (const [file, expectedCopy] of auditedSurfaceCopy) {
  const source = await readFile(resolve(root, file), "utf8");
  for (const copy of expectedCopy) {
    if (!source.includes(copy)) errors.push(`${file} no longer contains audited UI copy: ${copy}`);
    if (!translatedValues.has(copy)) errors.push(`${file} has audited UI copy without shared JoyI18n coverage: ${copy}`);
  }
}

const dashboardBootstrap = await readFile(resolve(root, "src/pages/dashboard/app-config.js"), "utf8");
if (!/import\(["']\/i18n\/index\.js/u.test(dashboardBootstrap)) {
  errors.push("Dashboard must bootstrap the shared /i18n/index.js runtime");
}
if (!/\/i18n\/i18n\.css/u.test(dashboardBootstrap)) {
  errors.push("Dashboard must load the shared /i18n/i18n.css styles");
}

const languageAdapterRules = [
  ["src/features/sales/sale-english-ui.js", /JoyI18n/u],
  ["src/features/project-details/turtlebot-roadmap-language.js", /JoyI18n/u],
];
for (const [file, required] of languageAdapterRules) {
  const path = resolve(root, file);
  try {
    if (!(await stat(path)).isFile()) continue;
    const source = await readFile(path, "utf8");
    if (!required.test(source)) errors.push(`${file} must delegate UI language to shared JoyI18n`);
    if (/const\s+EXACT_TEXT\s*=\s*new\s+Map/u.test(source)) errors.push(`${file} must not keep a private translation dictionary`);
  } catch {
    // Removed adapters are valid once their callers have been migrated.
  }
}

const taskEnglish = await readFile(resolve(root, "src/features/tasks/task-english.js"), "utf8");
if (!/\/api\/tasks\/english/u.test(taskEnglish)) errors.push("task-english.js must remain a task-content feature, not UI localization");

const agentPolicyRequirements = [
  ["AGENTS.md", [
    "docs/i18n.md",
    "src/i18n/locales/en.js",
    "src/i18n/locales/vi.js",
    "JoyI18n",
    "npm run i18n:check",
  ]],
  [".agents/skills/joy-dashboard/SKILL.md", [
    "docs/i18n.md",
    "JoyI18n",
    "npm run i18n:check",
  ]],
];

for (const [file, requiredFragments] of agentPolicyRequirements) {
  let source = "";
  try {
    source = await readFile(resolve(root, file), "utf8");
  } catch {
    errors.push(`${file} is required so coding agents inherit Joy's shared i18n rules`);
    continue;
  }
  for (const fragment of requiredFragments) {
    if (!source.includes(fragment)) {
      errors.push(`${file} must preserve the repository-wide i18n instruction: ${fragment}`);
    }
  }
}

if (errors.length) fail(errors);
console.log(`Joy i18n check passed: ${allKeys.size} shared keys across ${supported.join("/")}; src + project-data surfaces audited`);
