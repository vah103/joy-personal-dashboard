import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history edits from the row instead of a persistent action column", async () => {
  const [dashboard, build, interactions, styles] = await Promise.all([
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sale-history-row-edit.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sale-history-row-edit.css", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /sale-history-row-edit\.css\?v=joy-sale-history-row-edit-v1/);
  assert.match(dashboard, /sale-history-row-edit\.js\?v=joy-sale-history-row-edit-v1/);
  assert.match(build, /resolve\(salesFeatures, "sale-history-row-edit\.js"\)/);
  assert.match(build, /resolve\(salesFeatures, "sale-history-row-edit\.css"\)/);
  assert.match(interactions, /addEventListener\("dblclick"/);
  assert.match(interactions, /\(pointer: coarse\)/);
  assert.match(interactions, /Double-click a row to edit it/);
  assert.match(styles, /tr:not\(\.sales-history-edit-row\) > \.sales-history-actions-cell\s*\{\s*display:\s*none;/s);
});
