import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("IELTS popup exposes only the four agreed sections and no embedded coach", () => {
  const model = read("src/features/ielts/core-model.js");
  const ui = read("src/features/ielts/core-ui.js");
  const css = read("project-data/ielts/ielts-core.css");

  assert.match(model, /data-ielts-tab="now"/);
  assert.match(model, /data-ielts-tab="course"/);
  assert.match(model, /data-ielts-tab="journey"/);
  assert.match(model, /data-ielts-tab="progress"/);
  assert.match(ui, /External Writing Course/);
  assert.match(ui, /Band 7\.0 · December 2026/);
  assert.doesNotMatch(ui, /Strict Mode|Joy Coach|Story Bank/);
  assert.match(css, /font-family: "Nunito"/);
});
