import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("IELTS dashboard card preserves the original artwork and opens the new journey", () => {
  const build = read("scripts/build.mjs");
  const css = read("project-data/ielts/ielts-card.css");
  const script = read("src/features/ielts/card.js");

  assert.match(build, /ielts-card\.css\?v=ielts-journey-v5/);
  assert.match(build, /ielts-core\.css\?v=ielts-journey-v4/);
  assert.match(build, /ielts-core-bundle\.js\?v=ielts-journey-v4/);
  assert.match(script, /Band 7 by December/);
  assert.match(script, /Target Band 7\.0/);
  assert.match(script, /CURRENT RHYTHM/);
  assert.match(script, /NEXT TASK/);
  assert.match(script, /JOURNEY_VERSION = "journey-v4"/);
  assert.match(script, /subtitle\.textContent = "Band 7 by December/);
  assert.match(script, /window\.JoyIELTS\.open/);
  assert.doesNotMatch(script, /Strict Mode|Joy Coach|AI reviewer/);
  assert.match(css, /font-family: "Nunito"/);
  assert.match(css, /ielts-card-background\.webp/);
  assert.doesNotMatch(css, /project-card\.ielts-project-card::before/);
  assert.match(css, /top: 6px/);
  assert.match(css, /grid-template-columns: minmax\(0, 47%\) minmax\(0, 53%\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
});
