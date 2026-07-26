import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const router = fs.readFileSync(new URL("../worker/router.js", import.meta.url), "utf8");
const delivery = fs.readFileSync(new URL("../worker/reliable-reminder-delivery.js", import.meta.url), "utf8");
const serviceWorker = fs.readFileSync(new URL("../src/pwa/sw.js", import.meta.url), "utf8");

test("router uses the acknowledged reminder scheduler", () => {
  assert.ok(router.includes("runReliableReminderSchedule"));
  assert.ok(router.includes("handleReliableReminderRequest"));
  assert.ok(!router.includes("runTaskReminderSchedule"));
});

test("push acceptance does not immediately finish a task reminder", () => {
  assert.ok(delivery.includes("SET last_notified_at = ?, updated_at = ?"));
  assert.ok(delivery.includes("status = 'scheduled'"));
  assert.ok(delivery.includes("SET status = 'notified'"));
  assert.ok(delivery.includes("deliveryAttemptAt"));
  assert.ok(delivery.includes("RETRY_AFTER_MS"));
});

test("service worker confirms delivery only after showing the notification", () => {
  const showIndex = serviceWorker.indexOf("await self.registration.showNotification(notificationTitle, options)");
  const ackIndex = serviceWorker.indexOf('fetch("/api/task-reminders/delivery-ack"');
  assert.ok(showIndex >= 0);
  assert.ok(ackIndex > showIndex);
  assert.ok(serviceWorker.includes("deliveryAttemptAt"));
});
