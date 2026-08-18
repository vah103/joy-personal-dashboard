import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("History keeps row editing implicit instead of showing Edit on every display row", async () => {
  const [history, interactions, styles, bootstrap] = await Promise.all([
    read("../src/features/sales/appointments/history.js"),
    read("../src/features/sales/appointments/history-interactions.js"),
    read("../src/features/sales/appointments/history-interactions.css"),
    read("../src/features/sales/assistant/sales-assistant.js"),
  ]);

  assert.match(history, /content\.addEventListener\("dblclick"/);
  assert.match(history, /event\.key !== "Enter"/);
  assert.match(history, /startEditing\(row\.dataset\.viewingId/);
  assert.match(styles, /tr:not\(\.sales-history-edit-row\) > \.sales-history-actions-cell[\s\S]*display:\s*none/);
  assert.match(interactions, /data\.historyUxClose/);
  assert.match(interactions, /joy:sale-history-leave-request/);
  assert.match(interactions, /\[data-history-action="close-deal"\]/);
  assert.match(bootstrap, /appointments\/history-interactions\.js/);
});

test("History preserves the two-stage yellow pending to green received commission flow", async () => {
  const [interactions, styles, worker] = await Promise.all([
    read("../src/features/sales/appointments/history-interactions.js"),
    read("../src/features/sales/appointments/history-interactions.css"),
    read("../worker/sale-viewing-delete.js"),
  ]);

  assert.match(interactions, /\/api\/sales\/viewings\/commission/);
  assert.match(interactions, /new Set\(\["pending", "received"\]\)/);
  assert.match(interactions, /method:\s*"PATCH"/);
  assert.match(interactions, /commissionActionOpen/);
  assert.match(styles, /data-commission-state="pending"[\s\S]*#fff3cf/);
  assert.match(styles, /data-commission-state="received"[\s\S]*#d8efd9/);
  assert.match(styles, /data-deal-review="true"[\s\S]*display:\s*table-cell/);

  assert.match(worker, /const COMMISSION_PATH = "\/api\/sales\/viewings\/commission"/);
  assert.match(worker, /state IN \('pending', 'received'\)|normalizeCommissionState/);
  assert.match(worker, /SELECT id, user_email, 'pending'/);
  assert.match(worker, /currentState === "pending" \|\| currentState === "received"[\s\S]*\? "received"[\s\S]*: "pending"/);
});
