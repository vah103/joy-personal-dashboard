import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const router = fs.readFileSync(new URL("../worker/router.js", import.meta.url), "utf8");
const delivery = fs.readFileSync(new URL("../worker/reminder-delivery.js", import.meta.url), "utf8");
const reminderApi = fs.readFileSync(new URL("../worker/task-reminders.js", import.meta.url), "utf8");
const serviceWorker = fs.readFileSync(new URL("../src/pwa/sw.js", import.meta.url), "utf8");

test("router uses one consolidated reminder delivery module", () => {
  assert.ok(router.includes('from "./reminder-delivery.js"'));
  assert.ok(router.includes("runReliableReminderSchedule"));
  assert.ok(router.includes("handleReliableReminderRequest"));
  assert.ok(!router.includes("runNoTopicReminderSchedule"));
  assert.ok(!router.includes("runTaskReminderSchedule"));
});

test("task reminder API does not retain the replaced delivery scheduler", () => {
  assert.ok(!reminderApi.includes("runTaskReminderSchedule"));
  assert.ok(!reminderApi.includes("processDueTaskReminders"));
  assert.ok(!reminderApi.includes("processDueFocusReminders"));
  assert.ok(!reminderApi.includes("buildPushPayload"));
});

test("scheduled jobs cannot block one another", () => {
  assert.ok(router.includes("function scheduleIndependentJob"));
  assert.ok(router.includes('scheduleIndependentJob(ctx, "Gmail"'));
  assert.ok(router.includes('scheduleIndependentJob(ctx, "weather"'));
  assert.ok(router.includes('scheduleIndependentJob(ctx, "reminder"'));
  assert.ok(router.includes("Promise.resolve()"));
  assert.ok(router.includes(".catch((error) =>"));
  assert.ok(!router.includes("await app.scheduled(controller, env, ctx);\n    }\n    ctx.waitUntil"));
});

test("Apple reminder requests omit the optional Web Push Topic header", () => {
  assert.ok(delivery.includes("runReliableReminderSchedule"));
  assert.ok(delivery.includes("buildPushPayload"));
  assert.ok(delivery.includes('urgency: options.urgency || "high"'));
  assert.ok(!delivery.includes("topic:"));
  assert.ok(!delivery.includes("options.topic"));
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
