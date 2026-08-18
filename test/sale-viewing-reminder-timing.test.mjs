import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale viewing reminders fire at viewing time for new and existing pending appointments", async () => {
  const worker = await readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8");

  assert.doesNotMatch(worker, /REMINDER_LEAD_MS/);
  assert.match(worker, /const reminderAt = viewing\.viewingAt;/);
  assert.match(worker, /reminderAt = viewing\.viewingAt > now \? viewing\.viewingAt : null;/);
  assert.match(worker, /AND reminder_at IS NOT NULL[\s\S]*AND viewing_at <= \?[\s\S]*AND viewing_at >= \?/);
  assert.doesNotMatch(worker, /AND reminder_at <= \?/);
  assert.match(worker, /ORDER BY viewing_at ASC/);
  assert.match(worker, /đúng giờ hẹn/);
});
