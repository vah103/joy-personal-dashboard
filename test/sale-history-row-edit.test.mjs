import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history keeps row editing and exposes direct deal actions", async () => {
  const [dashboard, build, interactions, styles] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/appointments/history.css", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /sale-history-row-edit\.css\?v=joy-sale-history-row-edit-v1/);
  assert.match(dashboard, /sale-history-row-edit\.js\?v=joy-sale-history-row-edit-v1/);
  assert.match(build, /resolve\(saleAppointmentsFeature, "history\.js"\)/);
  assert.match(build, /resolve\(saleAppointmentsFeature, "history\.css"\)/);
  assert.match(interactions, /addEventListener\("dblclick"/);
  assert.match(interactions, /\(pointer: coarse\)/);
  assert.match(interactions, /Double-click a row to edit it/);
  assert.match(interactions, /sales-history-display-close-button/);
  assert.match(interactions, /edit\.textContent = "Edit"/);
  assert.match(styles, /tr:not\(\.sales-history-edit-row\) > \.sales-history-actions-cell\s*\{\s*display:\s*table-cell;/s);
});
