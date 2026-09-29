import { escapeMapHtml } from "./company-live-map-layout.js";
import { renderCompanyMap } from "./company-live-map-render.js";

const COMPANY_BOARD_API = "/api/company/live-board";
const STYLE_FILES = [
  "/company-live-map-shell.css?v=joy-company-live-map-v2",
  "/company-live-map-canvas.css?v=joy-company-live-map-v2",
];

function t(key, values = {}) {
  if (typeof window !== "undefined" && window.JoyI18n?.t) return window.JoyI18n.t(key, values);
  return key;
}

export function renderBoardMarkup(data, { translate = t } = {}) {
  return '<section class="company-board-dialog" role="dialog" aria-modal="true" aria-labelledby="company-board-title">' +
    renderCompanyMap(data, translate) + '</section>';
}

function ensureStyles() {
  if (typeof document === "undefined") return;
  for (const href of STYLE_FILES) {
    if (document.querySelector('link[href="' + href + '"]')) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.companyLiveMapStyle = "true";
    document.head.append(link);
  }
}

function installLauncher() {
  const actions = document.querySelector(".header-actions");
  if (!actions || actions.querySelector("[data-company-board-open]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "company-board-launcher";
  button.dataset.companyBoardOpen = "true";
  button.setAttribute("aria-label", t("companyBoard.open"));
  button.innerHTML = '<span aria-hidden="true">◎</span><span>' +
    escapeMapHtml(t("companyBoard.launcher")) + '</span>';
  actions.prepend(button);
}

let data = null;
let loading = false;
let errorCode = "";

function backdrop() {
  return document.querySelector("#company-live-board-backdrop");
}

function renderShell() {
  const root = backdrop();
  if (!root) return;
  if (loading) {
    root.innerHTML = '<section class="company-board-dialog company-board-state" role="dialog" aria-modal="true"><strong>' +
      escapeMapHtml(t("companyBoard.loading")) + '</strong></section>';
    return;
  }
  if (errorCode || !data) {
    const messageKey = errorCode === "AUTH_REQUIRED"
      ? "companyBoard.errorAuth"
      : "companyBoard.errorUnavailable";
    root.innerHTML = '<section class="company-board-dialog company-board-state" role="dialog" aria-modal="true">' +
      '<strong>' + escapeMapHtml(t("companyBoard.errorTitle")) + '</strong>' +
      '<p>' + escapeMapHtml(t(messageKey)) + '</p><div>' +
      '<button type="button" data-company-board-action="refresh">' + escapeMapHtml(t("companyBoard.refresh")) + '</button>' +
      '<button type="button" data-company-board-action="close">' + escapeMapHtml(t("common.close")) + '</button>' +
      '</div></section>';
    return;
  }
  root.innerHTML = renderBoardMarkup(data, { translate: t });
}

async function loadBoard() {
  if (loading) return;
  loading = true;
  errorCode = "";
  renderShell();
  try {
    const response = await fetch(COMPANY_BOARD_API, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(payload.error || "COMPANY_HUB_UNAVAILABLE"), {
        code: payload.error || "COMPANY_HUB_UNAVAILABLE",
      });
    }
    data = payload;
  } catch (error) {
    errorCode = String(error?.code || "COMPANY_HUB_UNAVAILABLE");
  } finally {
    loading = false;
    renderShell();
  }
}

function openBoard() {
  const root = backdrop();
  if (!root) return;
  root.hidden = false;
  document.body.classList.add("company-board-open");
  renderShell();
  if (!data) void loadBoard();
  window.requestAnimationFrame(() => root.querySelector('[data-company-board-action="close"]')?.focus());
}

function closeBoard() {
  const root = backdrop();
  if (!root) return;
  root.hidden = true;
  document.body.classList.remove("company-board-open");
  document.querySelector("[data-company-board-open]")?.focus();
}

function install() {
  if (typeof document === "undefined" || !document.body) return;
  ensureStyles();
  installLauncher();
  if (!backdrop()) {
    const root = document.createElement("div");
    root.id = "company-live-board-backdrop";
    root.className = "company-board-backdrop";
    root.hidden = true;
    document.body.append(root);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-company-board-open]")) {
      openBoard();
      return;
    }
    const action = event.target.closest?.("[data-company-board-action]")?.dataset.companyBoardAction;
    if (action === "close") closeBoard();
    if (action === "refresh") void loadBoard();
    if (event.target === backdrop()) closeBoard();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && backdrop() && !backdrop().hidden) closeBoard();
  });

  window.addEventListener("joy:i18n-ready", () => {
    installLauncher();
    if (backdrop() && !backdrop().hidden) renderShell();
  });
  window.addEventListener("joy:locale-changed", () => {
    const launcher = document.querySelector("[data-company-board-open]");
    if (launcher) {
      launcher.setAttribute("aria-label", t("companyBoard.open"));
      const label = launcher.querySelector("span:last-child");
      if (label) label.textContent = t("companyBoard.launcher");
    }
    if (backdrop() && !backdrop().hidden) renderShell();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
