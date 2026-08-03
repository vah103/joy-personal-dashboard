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
  "source-assignment.js",
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
  assert.equal(library.schemaVersion, 2, "IELTS source library schemaVersion must be 2");
  assert.ok(Array.isArray(library.providers), "IELTS source library providers must be an array");
  assert.ok(library.providers.length > 0, "IELTS source library must contain providers");
  assert.ok(Array.isArray(library.tests), "IELTS source library tests must be an array");
  assert.ok(library.tests.length > 0, "IELTS source library must contain concrete tests");

  const providerIds = new Set();
  const providerHosts = new Map();
  for (const provider of library.providers) {
    assert.match(provider.id, /^[a-z0-9][a-z0-9._-]*$/, `Invalid provider id: ${provider.id}`);
    assert.equal(providerIds.has(provider.id), false, `Duplicate provider id: ${provider.id}`);
    providerIds.add(provider.id);
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
    providerHosts.set(provider.id, new Set(provider.allowedHosts));
  }

  const testIds = new Set();
  const fullSkills = new Set();
  const providerCoverage = new Set();
  for (const test of library.tests) {
    assert.match(test.id, /^[a-z0-9][a-z0-9._-]*$/, `Invalid test id: ${test.id}`);
    assert.equal(testIds.has(test.id), false, `Duplicate test id: ${test.id}`);
    testIds.add(test.id);
    assert.ok(providerIds.has(test.providerId), `Unknown provider for ${test.id}`);
    assert.ok(["listening", "reading"].includes(test.skill), `Invalid skill for ${test.id}`);
    assert.ok(["full", "section"].includes(test.scope), `Invalid scope for ${test.id}`);
    assert.ok(Number(test.questionCount) > 0 && Number(test.questionCount) <= 40, `Invalid question count for ${test.id}`);
    if (test.scope === "full") {
      assert.equal(Number(test.questionCount), 40, `${test.id} full tests must contain 40 questions`);
      fullSkills.add(test.skill);
    }

    const url = new URL(test.url);
    assert.equal(url.protocol, "https:", `${test.id} must use HTTPS`);
    assert.ok(providerHosts.get(test.providerId)?.has(url.hostname), `${test.id} host is not allowlisted`);
    providerCoverage.add(`${test.providerId}:${test.skill}`);
  }

  assert.ok(providerIds.has("study4"), "IELTS source library must include STUDY4");
  assert.ok(providerIds.has("youpass"), "IELTS source library must include YouPass");
  assert.deepEqual(library.selectionPolicy?.randomCheckedPracticeSkills, ["listening", "reading"]);
  assert.ok(fullSkills.has("listening"), "The catalog needs full Listening tests");
  assert.ok(fullSkills.has("reading"), "The catalog needs full Reading tests");
  assert.ok(providerCoverage.has("study4:listening"));
  assert.ok(providerCoverage.has("study4:reading"));
  assert.ok(providerCoverage.has("youpass:listening"));
  assert.ok(providerCoverage.has("youpass:reading"));
  assert.ok(library.selectionPolicy?.storeOnly?.includes("testId"));
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

console.log("IELTS Journey frontend sources and random checked-practice catalog validated");
