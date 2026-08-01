import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const helperPath = resolve(root, "worker/shared/openai-responses.js");
const helper = await readFile(helperPath, "utf8");

test("OpenAI language requests stay server-side and stateless", () => {
  assert.match(helper, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(helper, /Authorization:\s*`Bearer \$\{apiKey\}`/);
  assert.match(helper, /store:\s*false/);
  assert.match(helper, /max_output_tokens/);
  assert.doesNotMatch(helper, /dangerouslyAllowBrowser|localStorage|sessionStorage/);
});

test("Language cache keys hash the user and input", () => {
  assert.match(helper, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(helper, /globalThis\.caches\?\.default/);
  assert.match(helper, /language-cache\.hey-joy\.internal/);
  assert.doesNotMatch(helper, /new Request\(`\$\{CACHE_ORIGIN\}\/\$\{safeFeature\}\/\$\{userEmail/);
});

test("OpenAI helper passes syntax validation", () => {
  const result = spawnSync(process.execPath, ["--check", helperPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
