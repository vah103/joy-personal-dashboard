import {
  ROLE_LABELS,
  currentTaskForRole,
  escapeMapHtml,
  pointForRole,
  stateForRole,
} from "./company-live-map-layout.js";
import { companyMapIcon } from "./company-live-map-icons.js";
import { renderMapEdges } from "./company-live-map-edges.js";

function stateLabel(state, t) {
  return t(state === "ACTIVE"
    ? "companyBoard.map.active"
    : state === "WAITING"
      ? "companyBoard.map.waiting"
      : "companyBoard.map.free");
}

function renderNode(role, index, t) {
  const point = pointForRole(role.position, index);
  const state = stateForRole(role);
  const task = currentTaskForRole(role);
  const name = ROLE_LABELS[role.position] || role.position;
  const director = role.position === "Research Director";
  return '<article class="company-map-node company-map-node--' + point.group +
    ' company-map-node--' + state.toLowerCase() +
    (director ? ' company-map-node--director' : '') +
    '" style="--node-x:' + (point.x / 10) + '%;--node-y:' + (point.y / 6.2) +
    '%" data-role="' + escapeMapHtml(role.position) +
    '" data-company-map-state="' + state + '">' +
    '<span class="company-map-icon">' + companyMapIcon(point.icon) + '</span>' +
    '<span class="company-map-node-copy"><strong>' + escapeMapHtml(name) + '</strong>' +
    (director ? '<small>' + escapeMapHtml(role.position) + '</small>' : '') +
    '<span class="company-map-state"><i aria-hidden="true"></i>' +
    escapeMapHtml(stateLabel(state, t)) + '</span>' +
    (task ? '<b class="company-map-task" data-i18n-skip>' + escapeMapHtml(task) + '</b>' : '') +
    '</span></article>';
}

export function renderCompanyMap(data, t) {
  const roles = Array.isArray(data?.roles) ? data.roles : [];
  return '<header class="company-map-header">' +
    '<div class="company-map-heading"><p class="company-board-kicker">' +
    escapeMapHtml(t("companyBoard.kicker")) + '</p><h2 id="company-board-title">' +
    escapeMapHtml(t("companyBoard.title")) + '</h2></div>' +
    '<div class="company-map-legend" aria-label="' + escapeMapHtml(t("companyBoard.map.legend")) + '">' +
    '<span><i class="is-active"></i>' + escapeMapHtml(t("companyBoard.map.active")) + '</span>' +
    '<span><i class="is-waiting"></i>' + escapeMapHtml(t("companyBoard.map.waiting")) + '</span>' +
    '<span><i class="is-free"></i>' + escapeMapHtml(t("companyBoard.map.free")) + '</span>' +
    '</div><div class="company-map-actions">' +
    '<button type="button" data-company-board-action="refresh" aria-label="' +
    escapeMapHtml(t("companyBoard.refresh")) + '" title="' + escapeMapHtml(t("companyBoard.refresh")) + '">↻</button>' +
    '<button type="button" data-company-board-action="close" aria-label="' +
    escapeMapHtml(t("common.close")) + '">×</button></div></header>' +
    '<div class="company-map-scroll"><main class="company-map-canvas" aria-label="' +
    escapeMapHtml(t("companyBoard.map.title")) + '">' +
    '<section class="company-map-region company-map-region--research"><h3>' +
    escapeMapHtml(t("companyBoard.map.research")) + '</h3></section>' +
    '<section class="company-map-region company-map-region--operations"><h3>' +
    escapeMapHtml(t("companyBoard.map.operations")) + '</h3></section>' +
    renderMapEdges(data) +
    '<div class="company-map-nodes">' +
    roles.map((role, index) => renderNode(role, index, t)).join("") +
    '</div></main></div>';
}
