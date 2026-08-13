import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import en from "../src/i18n/locales/en.js";
import vi from "../src/i18n/locales/vi.js";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(root, "src");
const dictionaries = { en, vi };
const supported = Object.keys(dictionaries);

function placeholders(value) {
  return [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

function fail(lines) {
  console.error("Joy i18n check failed:\n" + lines.map((line) => `- ${line}`).join("\n"));
  process.exit(1);
}

const errors = [];
const allKeys = new Set(Object.keys(en));
for (const locale of supported) {
  const keys = Object.keys(dictionaries[locale]);
  keys.forEach((key) => allKeys.add(key));
}

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

const files = await walk(sourceRoot);
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

if (errors.length) fail(errors);
console.log(`Joy i18n check passed: ${allKeys.size} shared keys across ${supported.join("/")}`);
