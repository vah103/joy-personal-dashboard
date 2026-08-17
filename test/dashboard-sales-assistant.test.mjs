import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard HTML loads the Sale Assistant without a hidden legacy launcher", async () => {
  const [dashboard, build, salesBuild, script, styles] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-sales.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/sales-assistant.css", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /sales-assistant\.css\?v=joy-dashboard-sales-assistant-v6/);
  assert.match(dashboard, /type="module" src="sales-assistant\.js\?v=joy-dashboard-sales-assistant-v5"/);
  assert.match(dashboard, /room-summary\.css\?v=joy-room-summary-v1/);
  assert.match(build, /resolve\(saleAppointmentsFeature, "appointment\.js"\)/);
  assert.match(build, /resolve\(saleSharedFeature, "format\.js"\)/);
  assert.match(salesBuild, /dist", "sales/);
  assert.match(salesBuild, /import "\.\/sales\/assistant\/sales-assistant\.js"/);
  assert.match(script, /Hẹn khách xem phòng/);
  assert.match(script, /Tóm tắt phòng/);
  assert.match(script, /dataset\.action = "open-sales-assistant"/);
  assert.match(script, /joy:sale-history-open/);
  assert.match(script, /id = "sales-commission"/);
  assert.match(script, /import\("\.\.\/room-summary\/room-summary\.js\?v=joy-room-summary-v1"\)/);
  assert.match(script, /joy:sales-changed/);
  assert.match(script, /refreshDashboardViewings/);
  assert.doesNotMatch(script, /Schedule a viewing/);
  assert.doesNotMatch(script, /sales-assistant-launch/);
  assert.doesNotMatch(styles, /\.sales-assistant-launch/);
  assert.match(styles, /\.sales-assistant-modal/);
  assert.match(styles, /#sales \.sales-dashboard-overview/);
});

test("assistant keeps Upcoming Viewings and converts the old manager heading into explicit actions", async () => {
  const [dashboard, script] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/sales-assistant.js", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /Upcoming viewings/i);
  assert.match(dashboard, /Manage 2026/);
  assert.match(script, /assistant\.textContent = "Sale Assistant"/);
  assert.match(script, /manager\.textContent = "Sale Manager"/);
  assert.match(script, /overview\.append\(upcoming\)/);
});
