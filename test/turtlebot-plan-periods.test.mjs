import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const referencePath = resolve(root, "project-data/turtlebot4/project-plan-v3-reference-ui.js");
const loaderPath = resolve(root, "src/features/project-hub/turtlebot-plan-loader.js");
const fontPath = resolve(root, "src/features/project-details/turtlebot-roadmap-font.css");

test("TurtleBot plan renders flexible reference periods in Nunito", async () => {
  const [reference, loader, fontCss] = await Promise.all([
    readFile(referencePath, "utf8"),
    readFile(loaderPath, "utf8"),
    readFile(fontPath, "utf8"),
  ]);

  assert.doesNotThrow(() => new Function(reference));
  assert.match(reference, /title: "Before Lab"/);
  assert.match(reference, /title: "At the Lab"/);
  assert.match(reference, /title: "After Lab"/);
  assert.match(reference, /title: "Home Work"/);
  assert.match(reference, /Completion Gate/);
  assert.doesNotMatch(reference, /const labels = \["Monday"/);
  assert.match(loader, /project-plan-v3-reference-ui\.js\?v=turtlebot-reference-no-progress-v2/);
  assert.match(loader, /project-hub-tabs-cleanup\.js\?v=turtlebot-doc-commands-v1/);
  assert.doesNotMatch(loader, /project-plan-v3-periods-ui\.js/);
  assert.match(fontCss, /#turtlebot-hub-modal,\s*#turtlebot-hub-modal \*/);
  assert.match(fontCss, /font-family: "Nunito"/);
  assert.match(fontCss, /grid-template-rows: auto minmax\(0, 1fr\)/);
});
