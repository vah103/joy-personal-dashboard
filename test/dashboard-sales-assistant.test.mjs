import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard build loads a visible Room Summary Assistant", async () => {
  const [build, script, styles] = await Promise.all([
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.css", import.meta.url), "utf8"),
  ]);

  assert.match(build, /sales-assistant\.css\?v=joy-dashboard-sales-assistant-v1/);
  assert.match(build, /type="module" src="sales-assistant\.js\?v=joy-dashboard-sales-assistant-v1"/);
  assert.match(build, /room-summary\.css\?v=joy-room-summary-v1/);
  assert.match(script, /Room Summary Assistant/);
  assert.match(script, /data-action = "open-sales-assistant"|dataset\.action = "open-sales-assistant"/);
  assert.match(script, /import\("\.\/room-summary\.js\?v=joy-room-summary-v1"\)/);
  assert.match(styles, /\.sales-assistant-launch/);
  assert.match(styles, /\.sales-assistant-modal/);
});

test("assistant keeps Upcoming Viewings and Manage 2026 intact", async () => {
  const [dashboard, script] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /Upcoming viewings/i);
  assert.match(dashboard, /Manage 2026/);
  assert.match(script, /salesSummary\.after\(launch\)/);
  assert.match(script, /manageButton\.before\(actions\)/);
});
