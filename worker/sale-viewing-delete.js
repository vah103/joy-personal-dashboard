import { isSameOrigin, json } from "./shared/http.js";
import { getSession } from "./shared/session.js";

export function isSaleViewingDeleteRoute(pathname) {
  return pathname === "/api/sales/viewings/delete";
}

export async function handleSaleViewingDeleteRequest(request, env) {
  if (request.method !== "DELETE") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const input = await request.json().catch(() => null);
  const id = String(input?.id || "").trim().slice(0, 120);
  if (!id) return json({ error: "VIEWING_ID_REQUIRED" }, 400);

  const result = await env.DB.prepare(`
    DELETE FROM sale_viewings
    WHERE id = ? AND user_email = ?
  `).bind(id, session.user_email).run();

  if (!Number(result.meta?.changes || 0)) {
    return json({ error: "VIEWING_NOT_FOUND" }, 404);
  }

  return json({
    ok: true,
    id,
    message: "Đã xóa lịch hẹn.",
  });
}
