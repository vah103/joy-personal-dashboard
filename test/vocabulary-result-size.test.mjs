import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const styles = await readFile(
  resolve(root, "project-data/vocabulary/vocabulary-result-size.css"),
  "utf8",
);
const loader = await readFile(
  resolve(root, "src/features/vocabulary/vocabulary-loader.js"),
  "utf8",
);

test("Vocabulary result word stays prominent without dominating the result card", () => {
  assert.match(styles, /font-size:\s*clamp\(30px, 3vw, 36px\)/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /font-size:\s*clamp\(28px, 7vw, 34px\)/);
  assert.match(loader, /vocabulary-result-size\.css\?v=joy-vocabulary-result-size-v1/);
});
