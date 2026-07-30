import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

export function isPushSubscriptionCleanupRoute(pathname) {
  return pathname === "/api/push/cleanup-current";
}

export async function handlePushSubscriptionCleanup(request, env) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

    const body = await readJson(request);
    const endpoint = String(body.endpoint || "").trim();
    if (!endpoint || endpoint.length > 4096) {
      return json({ error: "INVALID_PUSH_ENDPOINT" }, 400);
    }

    const userAgent = String(request.headers.get("User-Agent") || "").slice(0, 500);
    const current = await env.DB.prepare(`
      SELECT endpoint
      FROM push_subscriptions
      WHERE user_email = ? AND endpoint = ?
    `).bind(session.user_email, endpoint).first();

    if (!current) return json({ error: "CURRENT_SUBSCRIPTION_NOT_FOUND" }, 404);

    const result = await env.DB.prepare(`
      DELETE FROM push_subscriptions
      WHERE user_email = ?
        AND user_agent = ?
        AND endpoint <> ?
    `).bind(session.user_email, userAgent, endpoint).run();

    return json({
      ok: true,
      endpoint,
      removed: Number(result.meta?.changes || 0),
    });
  } catch (error) {
    console.error("Joy push subscription cleanup failed", error);
    return json({ error: String(error?.message || "PUSH_CLEANUP_FAILED") }, 500);
  }
}
