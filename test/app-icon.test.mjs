import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const manifest = JSON.parse(
  fs.readFileSync(new URL("../site.webmanifest", import.meta.url), "utf8"),
);

const loginHtml = fs.readFileSync(
  new URL("../login.html", import.meta.url),
  "utf8",
);

const indexHtml = fs.readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
);

const buildSource = fs.readFileSync(
  new URL("../scripts/build.mjs", import.meta.url),
  "utf8",
);

test("Joy uses the topographic blue icon everywhere", () => {
  assert.equal(manifest.icons.length, 1);
  assert.match(manifest.icons[0].src, /joy-blue-icon\.png/);
  assert.equal(manifest.icons[0].purpose, "any");

  assert.match(loginHtml, /apple-touch-icon[^>]+joy-blue-icon\.png/);
  assert.match(indexHtml, /apple-touch-icon[^>]+joy-blue-icon\.png/);

  assert.match(loginHtml, /site\.webmanifest/);
  assert.match(indexHtml, /site\.webmanifest/);

  assert.match(buildSource, /joy-blue-icon\.png/);
});
