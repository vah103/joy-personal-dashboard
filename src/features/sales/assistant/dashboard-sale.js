import { saleApi } from "../shared/api.js";
import { formatVnd, vietnamMonthKey } from "../shared/format.js";
import { saleText, translateSaleUiRoot } from "../shared/i18n.js";

const DEALS_ENDPOINT = "/api/sales/deals";
const state = { commissionLoadSeq: 0, installed: false };

export function decorateDashboardSaleCard() {
  const salesPanel = document.querySelector("#sales");
  const heading = salesPanel?.querySelector(".panel-heading");
  const salesBody = salesPanel?.querySelector(".sales-body");
  const upcoming = salesBody?.querySelector(".sales-summary");
  if (!salesPanel || !heading || !salesBody || !upcoming) return false;

  const titleButton = heading.querySelector(".panel-title-button");
  if (titleButton) {
    const wrapper = document.createElement("div");
    const title = titleButton.querySelector("h2");
    if (title) wrapper.append(title);
    titleButton.replaceWith(wrapper);
  }

  let actions = heading.querySelector(".sales-heading-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "sales-heading-actions";
    heading.append(actions);
  }

  let assistant = actions.querySelector('[data-action="open-sales-assistant"]');
  if (!assistant) {
    assistant = document.createElement("button");
    assistant.type = "button";
    assistant.className = "quiet-link sales-assistant-heading-button";
    assistant.dataset.action = "open-sales-assistant";
    actions.prepend(assistant);
  }
  assistant.textContent = saleText("saleAssistant.action", "Sale Assistant");

  const managerButtons = [...heading.querySelectorAll('[data-action="open-sale-manager"]')];
  const manager = managerButtons.at(-1);
  managerButtons.slice(0, -1).forEach((button) => button.remove());
  if (manager) {
    manager.textContent = saleText("sales.managerAction", "Sale Manager");
    actions.append(manager);
  }

  if (!salesBody.querySelector(".sales-dashboard-overview")) {
    const overview = document.createElement("div");
    overview.className = "sales-dashboard-overview";
    upcoming.before(overview);
    overview.append(upcoming);

    const commission = document.createElement("div");
    commission.className = "sales-summary sales-dashboard-commission";
    const label = document.createElement("p");
    label.className = "subheading";
    label.textContent = saleText("sales.commission", "Commission");
    const value = document.createElement("strong");
    value.id = "sales-commission";
    value.textContent = "—";
    commission.append(label, value);
    overview.append(commission);
  }

  translateSaleUiRoot(salesPanel);
  return true;
}

export async function loadDashboardCommission() {
  const target = document.querySelector("#sales-commission");
  if (!target) return;
  const requestSeq = ++state.commissionLoadSeq;
  try {
    const payload = await saleApi(DEALS_ENDPOINT);
    if (requestSeq !== state.commissionLoadSeq) return;
    const month = (Array.isArray(payload.months) ? payload.months : [])
      .find((item) => item?.key === vietnamMonthKey());
    target.textContent = formatVnd(month?.total || 0);
  } catch {
    if (requestSeq === state.commissionLoadSeq) target.textContent = "—";
  }
}

function refreshDashboardViewings() {
  if (typeof window.fetchCloudSales === "function") {
    void window.fetchCloudSales({ silent: true });
  }
}

export function installDashboardSale() {
  if (!decorateDashboardSaleCard()) return false;
  if (state.installed) return true;
  state.installed = true;
  void loadDashboardCommission();

  window.addEventListener("joy:sale-deal-saved", () => void loadDashboardCommission());
  window.addEventListener("joy:sales-changed", refreshDashboardViewings);
  const translate = () => decorateDashboardSaleCard();
  window.addEventListener("joy:i18n-ready", translate);
  window.addEventListener("joy:locale-changed", translate);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void loadDashboardCommission();
  });
  return true;
}
