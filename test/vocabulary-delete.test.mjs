import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const [frontend, styles, worker, loader] = await Promise.all([
  readFile(resolve(root, "project-data/vocabulary/vocabulary-library.js"), "utf8"),
  readFile(resolve(root, "project-data/vocabulary/vocabulary-library.css"), "utf8"),
  readFile(resolve(root, "worker/vocabulary.js"), "utf8"),
  readFile(resolve(root, "src/features/vocabulary/vocabulary-loader.js"), "utf8"),
]);

test("Saved Words only exposes delete while a saved row is being edited", () => {
  assert.match(frontend, /const editingRow = !isNew && editingCell\?\.id === item\.id/);
  assert.match(frontend, /editingRow \? deleteButtonMarkup\(item, deleting\) : ""/);
  assert.match(frontend, /data-vocab-library-delete/);
  assert.match(frontend, /window\.confirm\(`Delete/);
  assert.match(styles, /\.vocabulary-library-delete/);
  assert.match(styles, /tr\.is-editing-row \.vocabulary-library-example-vi-cell/);
});

test("Saved Words deletion removes only the authenticated user's D1 row", () => {
  assert.match(frontend, /operation:\s*"delete"/);
  assert.match(worker, /body\.operation === "delete"/);
  assert.match(worker, /deleteVocabularyWord/);
  assert.match(worker, /DELETE FROM vocabulary_words/);
  assert.match(worker, /WHERE user_email = \? AND id = \?/);
  assert.match(worker, /deleted:\s*true/);
});

test("Saved Words delete UI is cache-busted", () => {
  assert.match(loader, /vocabulary-library\.css\?v=joy-vocabulary-library-v4&ui=example-flashcards-v1/);
  assert.match(loader, /vocabulary-library\.js\?v=joy-vocabulary-library-v3&ui=example-flashcards-v1/);
});
