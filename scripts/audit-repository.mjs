import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter(Boolean).sort();

const errors = [];
const warnings = [];

const forbiddenPrefixes = ["dist/", "node_modules/", ".wrangler/"];
const forbiddenExact = new Set([
  "index.html",
  "app.js",
  "styles.css",
  ".nojekyll",
]);
const suspiciousName = /(?:^|\/)(?:copy(?:\s|[-_])|backup(?:\s|[-_])|old(?:\s|[-_])|temp(?:\s|[-_])|tmp(?:\s|[-_]))|\.(?:bak|backup|old|orig|tmp)$/i;
const secretName = /(?:^|\/)(?:\.dev\.vars|\.env(?:\..+)?|.*\.pem|.*\.key)$/i;

for (const path of tracked) {
  if (forbiddenPrefixes.some((prefix) => path.startsWith(prefix))) {
    errors.push(`${path}: generated or local-only content must not be tracked`);
  }
  if (forbiddenExact.has(path)) {
    errors.push(`${path}: obsolete root compatibility file must not be committed`);
  }
  if (suspiciousName.test(path)) {
    warnings.push(`${path}: looks like a backup or temporary copy`);
  }
  if (secretName.test(path) && path !== ".env.example") {
    errors.push(`${path}: possible secret file must not be tracked`);
  }

  const info = await stat(resolve(root, path));
  if (info.isFile() && info.size === 0 && !path.endsWith(".gitkeep")) {
    warnings.push(`${path}: tracked file is empty`);
  }
}

const projectHubPath = resolve(root, "src/features/project-hub/project-hub-performance.js");
const projectHub = await readFile(projectHubPath, "utf8");
if (/project-data\/(?:vocabulary|speaking)|loadVocabulary|loadSpeaking/i.test(projectHub)) {
  errors.push("Project Hub must not load Vocabulary or Speaking assets");
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (!String(packageJson.scripts?.build || "").includes("scripts/inject-language-tools.mjs")) {
  errors.push("The build pipeline is missing scripts/inject-language-tools.mjs");
}

const topLevelCounts = new Map();
for (const path of tracked) {
  const top = path.includes("/") ? path.slice(0, path.indexOf("/")) : "(root)";
  topLevelCounts.set(top, (topLevelCounts.get(top) || 0) + 1);
}

console.log(`Repository audit: ${tracked.length} tracked files`);
for (const [name, count] of [...topLevelCounts.entries()].sort()) {
  console.log(`- ${name}: ${count}`);
}
for (const warning of warnings) console.warn(`Warning: ${warning}`);

if (errors.length) {
  for (const error of errors) console.error(`Error: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Repository audit passed");
}
