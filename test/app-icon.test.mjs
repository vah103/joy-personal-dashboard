import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const manifest = JSON.parse(
  fs.readFileSync(new URL("../site.webmanifest", import.meta.url), "utf8"),
);
const buildSource = fs.readFileSync(
  new URL("../scripts/build.mjs", import.meta.url),
  "utf8",
);
const restoredIcon = fs.readFileSync(
  new URL("../app-icon-old.svg", import.meta.url),
  "utf8",
);

test("PWA installs with the restored blue wolf icon", () => {
  const scalableIcon = manifest.icons.find((icon) => icon.src.startsWith("app-icon-old.svg"));

  assert.ok(scalableIcon);
  assert.equal(scalableIcon.type, "image/svg+xml");
  assert.equal(scalableIcon.sizes, "any");
  assert.equal(scalableIcon.purpose, "any");
  assert.ok(manifest.icons.every((icon) => !String(icon.purpose).includes("maskable")));
});

test("Cloudflare build includes and cache-busts the restored icon", () => {
  assert.ok(restoredIcon.includes("data:image/jpeg;base64,"));
  assert.ok(buildSource.includes('cp(resolve(root, "app-icon-old.svg")'));
  assert.ok(buildSource.includes("joy-old-blue-wolf-v3"));
});
