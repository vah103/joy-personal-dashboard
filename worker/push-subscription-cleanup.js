const SESSION_COOKIE = "__Host-joy_session";

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

async function getSession(request, env) {
  const token = readCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return env.DB.prepare(`
    SELECT user_email, expires_at
    FROM sessions
    WHERE token_hash = ? AND expires_at > ?
  `).bind(tokenHash, Date.now()).first();
}

function readCookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return [name, rest.join("=")];
  }).filter(([name]) => name));
}

function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
