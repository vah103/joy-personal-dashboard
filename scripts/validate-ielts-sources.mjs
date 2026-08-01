import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ieltsDir = resolve(root, "src", "features", "ielts");
const sourceLibraryPath = resolve(root, "project-data", "ielts", "sources.json");

const bundledSources = [
  "core-model.js",
  "core-ui.js",
  "core-actions.js",
];

const standaloneSources = ["card.js"];

const bundledParts = await Promise.all(
  bundledSources.map((file) => readFile(resolve(ieltsDir, file), "utf8")),
);

const bundle = [
  "(function validateIeltsAugustCore() {",
  ...bundledParts,
  "})();",
].join("\n");

function validateSourceLibrary(library) {
  assert.equal(library.schemaVersion, 1, "IELTS source library schemaVersion must be 1");
  assert.ok(Array.isArray(library.providers), "IELTS source library providers must be an array");
  assert.ok(library.providers.length > 0, "IELTS source library must contain providers");

  const ids = new Set();
  for (const provider of library.providers) {
    assert.match(provider.id, /^[a-z0-9][a-z0-9._-]*$/, `Invalid provider id: ${provider.id}`);
    assert.equal(ids.has(provider.id), false, `Duplicate provider id: ${provider.id}`);
    ids.add(provider.id);
    assert.equal(provider.teacherRecommended, true, `${provider.id} must be teacher recommended`);
    assert.equal(provider.official, false, `${provider.id} must not be labelled official`);
    assert.ok(Array.isArray(provider.checkedSkills), `${provider.id} checkedSkills must be an array`);
    assert.ok(provider.checkedSkills.includes("listening"), `${provider.id} must support checked Listening practice`);
    assert.ok(provider.checkedSkills.includes("reading"), `${provider.id} must support checked Reading practice`);

    const homepage = new URL(provider.homepageUrl);
    assert.equal(homepage.protocol, "https:", `${provider.id} homepage must use HTTPS`);
    assert.ok(
      Array.isArray(provider.allowedHosts) && provider.allowedHosts.includes(homepage.hostname),
      `${provider.id} homepage host must be allowlisted`,
    );
  }

  assert.ok(ids.has("study4"), "IELTS source library must include STUDY4");
  assert.ok(ids.has("youpass"), "IELTS source library must include YouPass");
  assert.deepEqual(
    library.selectionPolicy?.teacherRecommendedCheckedPracticeSkills,
    ["listening", "reading"],
  );
  assert.ok(library.selectionPolicy?.storeOnly?.includes("rawResult"));
  assert.ok(library.selectionPolicy?.storeOnly?.includes("wrongItems"));
  assert.ok(library.selectionPolicy?.neverStore?.includes("fullThirdPartyAnswerKey"));
}

try {
  new Function(bundle);
  for (const file of standaloneSources) {
    const source = await readFile(resolve(ieltsDir, file), "utf8");
    new Function(source);
  }
  validateSourceLibrary(JSON.parse(await readFile(sourceLibraryPath, "utf8")));
} catch (error) {
  console.error("IELTS frontend or source-library validation failed before build.");
  throw error;
}

console.log("IELTS Journey frontend sources and approved practice library validated");
