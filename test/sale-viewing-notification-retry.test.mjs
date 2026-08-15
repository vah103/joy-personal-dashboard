import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(
  new URL("../worker/sale-viewings.js", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL("../migrations/20260815_sale_viewing_notification_claims.sql", import.meta.url),
  "utf8",
);

test("Sale viewing reminders keep delivery state separate from retryable claims", () => {
  assert.match(migration, /ADD COLUMN reminder_claimed_at INTEGER/u);
  assert.match(migration, /ADD COLUMN followup_claimed_at INTEGER/u);

  assert.match(worker, /reminder_notified_at IS NULL/u);
  assert.match(worker, /reminder_claimed_at IS NULL OR reminder_claimed_at <= \?/u);
  assert.match(worker, /followup_notified_at IS NULL/u);
  assert.match(worker, /followup_claimed_at IS NULL OR followup_claimed_at <= \?/u);

  assert.match(worker, /SET \$\{columns\.claimed\} = \?, updated_at = \?/u);
  assert.match(worker, /SET \$\{columns\.notified\} = \?, \$\{columns\.claimed\} = NULL, updated_at = \?/u);
  assert.match(worker, /if \(accepted\) await finishNotification\(row\.id, "reminder", attemptAt, env\)/u);
  assert.match(worker, /if \(accepted\) await finishNotification\(row\.id, "followup", attemptAt, env\)/u);
});

test("stale claims can be retried without reopening already delivered notifications", () => {
  assert.match(worker, /attemptAt - RETRY_AFTER_MS/u);
  assert.match(
    worker,
    /WHERE id = \? AND cancelled_at IS NULL\s+AND \$\{columns\.notified\} IS NULL\s+AND \(\$\{columns\.claimed\} IS NULL OR \$\{columns\.claimed\} <= \?\)/u,
  );
  assert.match(
    worker,
    /WHERE id = \? AND \$\{columns\.notified\} IS NULL AND \$\{columns\.claimed\} = \?/u,
  );
});
