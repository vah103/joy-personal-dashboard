import { buildPushPayload } from "@block65/webcrypto-web-push";

const RETRY_AFTER_MS = 2 * 60 * 1000;
const MAX_LATE_MS = 24 * 60 * 60 * 1000;

export async function runNoTopicReminderSchedule(env) {
  if (!hasPushConfig(env)) return;
  await Promise.allSettled([
    processTaskDeliveries(env),
    processFocusDeliveries(env),
  ]);
}

async function processTaskDeliveries(env) {
  const now = Date.now();
  const rows = await env.DB.prepare(`
    SELECT r.user_email, r.task_id, r.snoozed_until, t.title
    FROM task_reminders r
    JOIN tasks t ON t.id = r.task_id AND t.user_email = r.user_email
    WHERE r.notification_enabled = 1
      AND r.status = 'scheduled'
      AND t.done = 0
      AND COALESCE(r.snoozed_until, r.due_at) <= ?
      AND COALESCE(r.snoozed_until, r.due_at) >= ?
      AND (r.last_notified_at IS NULL OR r.last_notified_at <= ?)
    ORDER BY COALESCE(r.snoozed_until, r.due_at) ASC
    LIMIT 50
  `).bind(now, now - MAX_LATE_MS, now - RETRY_AFTER_MS).all();

  for (const row of rows.results) {
    const attemptAt = Date.now();
    const claim = await env.DB.prepare(`
      UPDATE task_reminders
      SET last_notified_at = ?, updated_at = ?
      WHERE user_email = ? AND task_id = ?
        AND status = 'scheduled'
        AND notification_enabled = 1
        AND (last_notified_at IS NULL OR last_notified_at <= ?)
    `).bind(
      attemptAt,
      attemptAt,
      row.user_email,
      row.task_id,
      attemptAt - RETRY_AFTER_MS,
    ).run();
    if (!Number(claim.meta?.changes || 0)) continue;

    const accepted = await sendPushToUser(row.user_email, {
      title: "Task reminder",
      body: String(row.title || "You have a task to do."),
      icon: "/app-icon-192.png",
      badge: "/app-icon-64.png",
      tag: `hey-joy-task-${row.task_id}`,
      renotify: true,
      actions: [
        { action: "complete", title: "Complete" },
        { action: "snooze10", title: "10 min" },
        { action: "snooze60", title: "1 hour" },
      ],
      data: {
        url: `/?task=${encodeURIComponent(row.task_id)}#to-do`,
        kind: "task-reminder",
        taskId: String(row.task_id),
        deliveryAttemptAt: attemptAt,
      },
    }, env, {
      ttl: 6 * 60 * 60,
      urgency: "high",
    });

    if (accepted) continue;
    await env.DB.prepare(`
      UPDATE task_reminders
      SET last_notified_at = NULL, updated_at = ?
      WHERE user_email = ? AND task_id = ?
        AND status = 'scheduled' AND last_notified_at = ?
    `).bind(Date.now(), row.user_email, row.task_id, attemptAt).run();
  }
}

async function processFocusDeliveries(env) {
  const now = Date.now();
  const rows = await env.DB.prepare(`
    SELECT user_email, message, next_at, updated_at
    FROM focus_reminders
    WHERE enabled = 1
      AND next_at IS NOT NULL
      AND next_at <= ?
      AND updated_at <= ?
    LIMIT 30
  `).bind(now, now - RETRY_AFTER_MS).all();

  for (const row of rows.results) {
    const attemptAt = Date.now();
    const claim = await env.DB.prepare(`
      UPDATE focus_reminders
      SET updated_at = ?
      WHERE user_email = ? AND enabled = 1
        AND next_at IS NOT NULL AND next_at <= ?
        AND updated_at <= ?
    `).bind(
      attemptAt,
      row.user_email,
      attemptAt,
      attemptAt - RETRY_AFTER_MS,
    ).run();
    if (!Number(claim.meta?.changes || 0)) continue;

    const accepted = await sendPushToUser(row.user_email, {
      title: "Focus reminder",
      body: String(row.message || "Stay focused"),
      icon: "/app-icon-192.png",
      badge: "/app-icon-64.png",
      tag: "hey-joy-focus",
      data: {
        url: "/#to-do",
        kind: "focus-reminder",
        deliveryAttemptAt: attemptAt,
      },
    }, env, {
      ttl: 60 * 60,
      urgency: "normal",
    });

    if (accepted) continue;
    await env.DB.prepare(`
      UPDATE focus_reminders
      SET updated_at = ?
      WHERE user_email = ? AND enabled = 1 AND updated_at = ?
    `).bind(attemptAt - RETRY_AFTER_MS, row.user_email, attemptAt).run();
  }
}

async function sendPushToUser(email, payload, env, options = {}) {
  const rows = await env.DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_email = ?
  `).bind(email).all();
  if (!rows.results.length) return false;

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const deadEndpoints = [];
  let accepted = 0;

  await Promise.all(rows.results.map(async (row) => {
    try {
      const subscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      const requestInit = await buildPushPayload({
        data: JSON.stringify(payload),
        options: {
          ttl: Number(options.ttl || 300),
          urgency: options.urgency || "high",
        },
      }, subscription, vapid);
      const response = await fetch(row.endpoint, requestInit);
      if (response.ok) accepted += 1;
      else if (response.status === 404 || response.status === 410) deadEndpoints.push(row.endpoint);
      else {
        const details = await response.text().catch(() => "");
        console.error("Joy no-topic reminder push failed", response.status, details.slice(0, 300));
      }
    } catch (error) {
      console.error("Joy no-topic reminder encryption failed", error);
    }
  }));

  if (deadEndpoints.length) {
    await env.DB.batch(deadEndpoints.map((endpoint) => (
      env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint)
    )));
  }
  return accepted > 0;
}

function hasPushConfig(env) {
  return Boolean(env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}
