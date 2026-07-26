import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const router = fs.readFileSync(new URL("../worker/router.js", import.meta.url), "utf8");
const scheduler = fs.readFileSync(new URL("../worker/no-topic-reminder-schedule.js", import.meta.url), "utf8");
const delivery = fs.readFileSync(new URL("../worker/reliable-reminder-delivery.js", import.meta.url), "utf8");
const serviceWorker = fs.readFileSync(new URL("../src/pwa/sw.js", import.meta.url), "utf8");

test("router uses the topic-free scheduler and keeps delivery acknowledgements", () => {
  assert.ok(router.includes("runNoTopicReminderSchedule"));
  assert.ok(router.includes("handleReliableReminderRequest"));
  assert.ok(!router.includes("runReliableReminderSchedule"));
  assert.ok(!router.includes("runTaskReminderSchedule"));
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
  assert.ok(scheduler.includes("runNoTopicReminderSchedule"));
  assert.ok(scheduler.includes("buildPushPayload"));
  assert.ok(scheduler.includes('urgency: options.urgency || "high"'));
  assert.ok(!scheduler.includes("topic:"));
  assert.ok(!scheduler.includes("options.topic"));
});

test("push acceptance does not immediately finish a task reminder", () => {
  assert.ok(scheduler.includes("SET last_notified_at = ?, updated_at = ?"));
  assert.ok(scheduler.includes("status = 'scheduled'"));
  assert.ok(delivery.includes("SET status = 'notified'"));
  assert.ok(scheduler.includes("deliveryAttemptAt"));
  assert.ok(scheduler.includes("RETRY_AFTER_MS"));
});

test("service worker confirms delivery only after showing the notification", () => {
  const showIndex = serviceWorker.indexOf("await self.registration.showNotification(notificationTitle, options)");
  const ackIndex = serviceWorker.indexOf('fetch("/api/task-reminders/delivery-ack"');
  assert.ok(showIndex >= 0);
  assert.ok(ackIndex > showIndex);
  assert.ok(serviceWorker.includes("deliveryAttemptAt"));
});
