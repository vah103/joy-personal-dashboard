import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard Settings is a compact gear inside the profile card area", async () => {
  const css = await readFile(new URL("../src/i18n/i18n.css", import.meta.url), "utf8");

  assert.match(css, /\.sidebar-footer\{position:relative\}/);
  assert.match(css, /\.sidebar-footer > \.joy-settings-trigger\{[\s\S]*position:absolute;[\s\S]*width:28px;[\s\S]*height:28px;/);
  assert.match(css, /\.sidebar-footer > \.joy-settings-trigger \[data-joy-settings-label\]\{display:none\}/);
  assert.match(css, /\.sidebar-footer:has\(\.joy-signout\) > \.joy-settings-trigger\{right:50px\}/);
  assert.match(css, /\.joy-settings-trigger-sale\{[\s\S]*margin:0 0 12px;/);
});
