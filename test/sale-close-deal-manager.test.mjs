import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("first History close hands the viewing to Sale Manager", async () => {
  const closeDeal = await readFile(new URL("../src/features/sales/history/close-deal.js", import.meta.url), "utf8");

  assert.match(closeDeal, /CLOSE_DEAL_DRAFT_KEY = "joy:sale-close-manager-draft"/);
  assert.match(closeDeal, /window\.sessionStorage\.setItem\(CLOSE_DEAL_DRAFT_KEY/);
  assert.match(closeDeal, /window\.location\.assign\("\/sale-manager\.html"\)/);
  assert.match(closeDeal, /commissionStateForRow\(row\) === "none"/);
  assert.match(closeDeal, /advanceCommissionState\(row, button, setMessage\)/);
});

test("Sale Manager prefills the viewing and marks pending only after saving the deal", async () => {
  const manager = await readFile(new URL("../src/features/sales/manager/manager.js", import.meta.url), "utf8");

  assert.match(manager, /function prefillCloseDealDraft\(\)/);
  assert.match(manager, /elements\.form\.elements\.customer\.value = draft\.customer/);
  assert.match(manager, /elements\.form\.elements\.phone\.value = draft\.phone/);
  assert.match(manager, /elements\.form\.elements\.address\.value = draft\.address/);
  assert.match(manager, /await apiRequest\("\/api\/sales\/deals"/);
  assert.match(manager, /await setViewingCommissionState\(viewingDraft\.viewingId, "pending"\)/);
  assert.match(manager, /CLOSE_DEAL_PENDING_SYNC_KEY/);
});

test("commission endpoint supports idempotent explicit pending state while retaining legacy toggle", async () => {
  const worker = await readFile(new URL("../worker/sale-viewing-delete.js", import.meta.url), "utf8");

  assert.match(worker, /const requestedState = normalizeCommissionState\(input\?\.state\)/);
  assert.match(worker, /requestedState !== "none"/);
  assert.match(worker, /VIEWING_COMMISSION_STATE_INVALID/);
  assert.match(worker, /currentState === "pending" \|\| currentState === "received"/);
});
