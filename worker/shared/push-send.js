import { buildPushPayload } from "@block65/webcrypto-web-push";

export function hasPushConfig(env) {
  return Boolean(env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export async function sendPushToUser(email, payload, env, options = {}) {
  if (!hasPushConfig(env)) return false;
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
        console.error("Joy push failed", response.status, details.slice(0, 300));
      }
    } catch (error) {
      console.error("Joy push encryption failed", error);
    }
  }));

  if (deadEndpoints.length) {
    await env.DB.batch(deadEndpoints.map((endpoint) => (
      env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint)
    )));
  }
  return accepted > 0;
}
