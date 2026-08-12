import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale history keeps only delete and save while editing", async () => {
  const [interaction, styles, endpoint, router] = await Promise.all([
    readFile(new URL("../src/features/sales/sale-history-row-edit.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sale-history-row-edit.css", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
  ]);

  assert.match(interaction, /textContent = "Xóa"/);
  assert.match(interaction, /method: "DELETE"/);
  assert.match(interaction, /document\.addEventListener\("click"/);
  assert.match(interaction, /cancelEditing\(content\)/);
  assert.match(
    interaction,
    /event\.target\.closest\?\.\(EDIT_CONTROL_SELECTOR\)\) return;/,
    "the synthetic hidden Edit click must not be mistaken for an outside click",
  );
  assert.match(interaction, /headers\[5\]\.textContent = "Nhắc"/);
  assert.match(interaction, /headers\[6\]\.remove\(\)/);
  assert.match(interaction, /return "Chờ nhắc"/);
  assert.match(interaction, /return "Đã nhắc"/);
  assert.match(interaction, /return "Chờ follow-up"/);
  assert.match(interaction, /return "Đã follow-up"/);
  assert.match(styles, /\.sales-history-cancel-button\s*\{\s*display:\s*none !important;/s);
  assert.match(styles, /min-width:\s*960px/);
  assert.match(styles, /th:nth-child\(4\)[\s\S]*?width:\s*28%/);
  assert.match(styles, /th:nth-child\(5\)[\s\S]*?width:\s*12%[\s\S]*?text-align:\s*center/);
  assert.match(styles, /th:nth-child\(6\)[\s\S]*?width:\s*14%[\s\S]*?min-width:\s*132px[\s\S]*?text-align:\s*center/);
  assert.match(endpoint, /DELETE FROM sale_viewings/);
  assert.match(endpoint, /WHERE id = \? AND user_email = \?/);
  assert.match(router, /isSaleViewingDeleteRoute/);
  assert.match(router, /handleSaleViewingDeleteRequest/);
});
