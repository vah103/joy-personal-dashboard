import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const periodsPath = resolve(root, "project-data/turtlebot4/project-plan-v3-periods-ui.js");
const loaderPath = resolve(root, "src/features/project-hub/project-hub-performance.js");
const fontPath = resolve(root, "src/features/project-details/turtlebot-roadmap-font.css");

test("TurtleBot plan renders flexible workflow periods in Nunito", async () => {
  const [periods, loader, fontCss] = await Promise.all([
    readFile(periodsPath, "utf8"),
    readFile(loaderPath, "utf8"),
    readFile(fontPath, "utf8"),
  ]);

  assert.doesNotThrow(() => new Function(periods));
  assert.match(periods, /title: "Before Lab"/);
  assert.match(periods, /title: "At the Lab"/);
  assert.match(periods, /title: "After Lab"/);
  assert.match(periods, /title: "Home Work"/);
  assert.match(periods, /Completion Gate/);
  assert.doesNotMatch(periods, /const labels = \["Monday"/);
  assert.match(periods, /overdueWeeks = weeks\.filter\(\(item\) => item\.end < date/);
  assert.match(loader, /project-plan-v3-periods-ui\.js\?v=turtlebot-flexible-periods-nunito-v1/);
  assert.match(fontCss, /#turtlebot-hub-modal,\s*#turtlebot-hub-modal \*/);
  assert.match(fontCss, /font-family: "Nunito"/);
});