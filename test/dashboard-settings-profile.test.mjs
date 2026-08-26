import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard Settings moves from the sidebar into the Joy account popup", async () => {
  const [css, config] = await Promise.all([
    readFile(new URL("../src/i18n/i18n.css", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/app-config.js", import.meta.url), "utf8"),
  ]);

  assert.match(css, /\.joy-account-heading-actions > \.joy-settings-trigger-account\{[\s\S]*width:34px;[\s\S]*height:34px;/);
  assert.match(css, /\.joy-account-heading-actions > \.joy-settings-trigger-account \[data-joy-settings-label\]\{display:none\}/);

  assert.match(config, /function moveSettingsIntoAccount\(\)/);
  assert.match(config, /\.sidebar-footer > \[data-joy-settings-open\]/);
  assert.match(config, /#joy-account-modal \.joy-account-heading-actions/);
  assert.match(config, /actions\.insertBefore\(button, notificationSlot \|\| actions\.firstChild\)/);
  assert.match(config, /window\.addEventListener\("joy:i18n-ready", watchForSettingsAndAccountPopup\)/);
  assert.match(config, /\/i18n\/i18n\.css\?v=joy-i18n-v2/);
  assert.match(config, /\/i18n\/index\.js\?v=joy-i18n-v2/);
});
