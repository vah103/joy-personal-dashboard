import { canonicalRoleActor, escapeMapHtml, pointForRole } from "./company-live-map-layout.js";

export function buildMapEdges(data) {
  const roles = new Set((data?.roles || []).map((role) => role.position));
  const edges = [];
  const seen = new Set();

  for (const relation of data?.relationships || []) {
    const from = canonicalRoleActor(relation.from, roles);
    const to = canonicalRoleActor(relation.to, roles);
    if (!from || !to || from === to || seen.has(from + "|" + to)) continue;
    seen.add(from + "|" + to);
    edges.push({ from, to, taskId: String(relation.taskId || ""), emphasis: "current" });
  }

  const openTaskIds = new Set(
    (data?.tasks || [])
      .filter((task) => !["DONE", "CANCELLED"].includes(String(task.status || "")))
      .map((task) => task.id),
  );
  const handoffs = [...(data?.handoffs || [])]
    .filter((item) => (
      item?.publishedAt
      && !Number.isNaN(Date.parse(item.publishedAt))
      && item.taskId
      && openTaskIds.has(item.taskId)
      && ["PENDING_PICKUP", "ACKNOWLEDGED"].includes(item.pickupState)
    ))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  for (const item of handoffs) {
    if (edges.length >= 6) break;
    const from = canonicalRoleActor(item.senderRole, roles);
    const to = canonicalRoleActor(item.receiverPosition, roles);
    if (!from || !to || from === to || seen.has(from + "|" + to)) continue;
    seen.add(from + "|" + to);
    edges.push({
      from,
      to,
      taskId: String(item.taskId || ""),
      emphasis: "current",
    });
  }
  return edges;
}

export function renderMapEdges(data) {
  const roles = new Set((data?.roles || []).map((role) => role.position));
  const points = new Map([...roles].map((name, index) => [name, pointForRole(name, index)]));

  return '<svg class="company-map-edges" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">' +
    '<defs>' +
    '<marker id="company-arrow-current" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 10 5 0 10Z"/></marker>' +
    '<marker id="company-arrow-previous" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10Z"/></marker>' +
    '</defs>' +
    buildMapEdges(data).map((edge, index) => {
      const a = points.get(edge.from);
      const b = points.get(edge.to);
      if (!a || !b) return "";
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 + ((index % 3) - 1) * 16;
      const label = edge.taskId
        ? '<text x="' + mx + '" y="' + (my - 8) + '">' + escapeMapHtml(edge.taskId) + '</text>'
        : "";
      return '<g class="company-edge company-edge--' + edge.emphasis + '">' +
        '<path d="M ' + a.x + ' ' + a.y + ' Q ' + mx + ' ' + my + ' ' + b.x + ' ' + b.y +
        '" marker-end="url(#company-arrow-' + edge.emphasis + ')"/>' + label + '</g>';
    }).join("") + '</svg>';
}
