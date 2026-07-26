const financeData = document.querySelector("#finance-data");
const financePrivacyToggle = document.querySelector("[data-action='toggle-finance-privacy']");
const financePeriod = document.querySelector("#finance-period");
const financeSource = document.querySelector("#finance-source");
const financeSyncState = document.querySelector("#finance-sync-state");
const financeMonths = document.querySelector("#finance-months");
const financeValues = [...document.querySelectorAll("[data-finance-value]")];
const financeComparison = document.querySelector("#finance-comparison");
const financeSaleProgress = document.querySelector("#finance-sale-progress");
const financeSaleShare = document.querySelector("#finance-sale-share");
const financeSaleCount = document.querySelector("#finance-sale-count");
const financeSaleStatus = document.querySelector("#finance-sale-status");
const FINANCE_CLOUD_BACKEND = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
const FINANCE_REVEAL_MS = 60_000;

let financeValuesHidden = true;
let financePrivacyTimer;

function setFinancePrivacy(hidden, { announce = false } = {}) {
  if (!financeData || !financePrivacyToggle) return;
  financeValuesHidden = hidden;
  window.clearTimeout(financePrivacyTimer);

  financeData.classList.toggle("finance-values-hidden", hidden);
  financePrivacyToggle.setAttribute("aria-pressed", String(hidden));
  financePrivacyToggle.setAttribute("aria-label", hidden ? "Show finance amounts" : "Hide finance amounts");
  financeValues.forEach((element) => {
    element.textContent = hidden ? element.dataset.financeMask : element.dataset.financeValue;
  });

  if (!hidden) financePrivacyTimer = window.setTimeout(() => setFinancePrivacy(true), FINANCE_REVEAL_MS);
  if (announce) showFinanceToast(hidden ? "Finance amounts hidden" : "Finance amounts visible for 60 seconds");
}

function renderFinance(payload) {
  const current = payload?.current || {};
  const months = Array.isArray(payload?.months) ? payload.months : [];
  financePeriod.textContent = current.label || "2026";

  ["remaining", "income", "expenses"].forEach((field) => {
    const element = document.querySelector(`[data-finance-field="${field}"]`);
    if (!element) return;
    element.dataset.financeValue = formatCompactVnd(current[field]);
  });

  const sale = payload?.sale || {};
  const goldValue = document.querySelector('[data-finance-field="gold"]');
  if (goldValue) goldValue.dataset.financeValue = `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(payload?.gold?.chi || 0))} chỉ`;
  const saleValue = document.querySelector('[data-finance-field="sale"]');
  if (saleValue) saleValue.dataset.financeValue = formatCompactVnd(sale.income);
  const share = current.income > 0 ? Math.min(100, Math.max(0, (Number(sale.income || 0) / current.income) * 100)) : 0;
  if (financeSaleProgress) financeSaleProgress.style.width = `${share.toFixed(1)}%`;
  if (financeSaleShare) financeSaleShare.innerHTML = `${Math.round(share)}% <small>of monthly income</small>`;
  if (financeSaleCount) financeSaleCount.textContent = `${Number(sale.count || 0)} ${Number(sale.count || 0) === 1 ? "entry" : "entries"}`;
  if (financeSaleStatus) financeSaleStatus.textContent = Number(sale.count || 0) ? "Live from Sale" : "No entries yet";

  renderFinanceComparison(months, current.key);

  if (payload?.spreadsheetUrl) {
    document.querySelectorAll(".finance-sheet-link").forEach((link) => {
      link.href = payload.spreadsheetUrl;
    });
  }

  renderFinanceChart(months, current.key);
  financeSource.textContent = `Live · ${payload?.source || "Finance Tracker"}`;
  financeSyncState.hidden = true;
  setFinancePrivacy(financeValuesHidden);
}

function renderFinanceChart(allMonths, currentKey) {
  const months = allMonths.filter((month) => !currentKey || month.key <= currentKey);
  const allValues = months.map((month) => Number(month?.remaining || 0));
  const minimum = Math.min(0, ...allValues);
  const maximum = Math.max(1, ...allValues);
  const span = maximum - minimum || 1;
  const width = 572;
  const height = 118;
  const left = 14;
  const top = 18;

  const coordinates = months.map((month, index) => {
    const x = left + (months.length <= 1 ? width : (index / (months.length - 1)) * width);
    const y = top + ((maximum - Number(month?.remaining || 0)) / span) * height;
    return { x, y };
  });
  const points = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  document.querySelector('[data-finance-series="remaining"]')?.setAttribute("points", points);
  const area = document.querySelector("[data-finance-area]");
  if (area) { const line = coordinates.map(({ x, y }) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" "); area.setAttribute("d", coordinates.length ? `M${coordinates[0].x.toFixed(1)} 154 ${line} L${coordinates.at(-1).x.toFixed(1)} 154Z` : ""); }
  const pointGroup = document.querySelector("[data-finance-points]");
  if (pointGroup) pointGroup.replaceChildren(...coordinates.map(({ x, y }, index) => { const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle"); circle.setAttribute("cx", x.toFixed(1)); circle.setAttribute("cy", y.toFixed(1)); circle.setAttribute("r", index === coordinates.length - 1 ? "5" : "3.5"); circle.setAttribute("class", `finance-point${index === coordinates.length - 1 ? " is-current" : ""}`); return circle; }));

  financeMonths.replaceChildren(...months.map((month) => {
    const label = document.createElement("i");
    label.textContent = month.shortLabel || "";
    if (month.key === currentKey) label.classList.add("is-current");
    return label;
  }));
  const chartPeriod = document.querySelector("#finance-chart-period");
  if (chartPeriod && months.length) {
    chartPeriod.textContent = `${months[0].label.split(" ")[0]} – ${months.at(-1).label}`;
  }
}

function renderFinanceComparison(months, currentKey) {
  if (!financeComparison) return;
  const index = months.findIndex((month) => month.key === currentKey);
  const current = Number(months[index]?.remaining || 0);
  const previous = Number(months[index - 1]?.remaining || 0);
  const hasBaseline = index > 0 && previous !== 0;
  const percent = hasBaseline ? ((current - previous) / Math.abs(previous)) * 100 : 0;
  const positive = percent >= 0;
  financeComparison.classList.toggle("is-negative", !positive);
  financeComparison.querySelector("i").textContent = positive ? "↗" : "↘";
  financeComparison.querySelector("b").textContent = hasBaseline ? `${positive ? "+" : ""}${Math.round(percent)}%` : "—";
  financeComparison.lastChild.textContent = ` compared with ${index > 0 ? months[index - 1].shortLabel : "last month"}`;
}

async function loadFinance() {
  if (!financeData) return;
  if (!FINANCE_CLOUD_BACKEND) {
    financeSource.textContent = "Connect Joy to load Finance Tracker";
    return;
  }

  try {
    const response = await fetch("/api/finance/summary", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error || "FINANCE_SYNC_FAILED"), { code: payload.error });
    renderFinance(payload);
  } catch (error) {
    financeSyncState.hidden = false;
    financeSyncState.innerHTML = error.code === "AUTH_REQUIRED" || error.code === "SHEETS_AUTHORIZATION_REQUIRED"
      ? '<strong>Finance is not connected</strong><a href="/auth/start">Connect Google</a>'
      : '<strong>Finance could not sync</strong><button type="button" data-finance-retry>Try again</button>';
    financeSource.textContent = "Finance Tracker unavailable";
    financeSyncState.querySelector("[data-finance-retry]")?.addEventListener("click", loadFinance, { once: true });
  }
}

function formatCompactVnd(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000) {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(amount / 1_000_000)} tr ₫`;
  }
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount)} ₫`;
}

function showFinanceToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2200);
}

function animateGreetingCharacters() {
  const greeting = document.querySelector("#greeting");
  if (!greeting || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const text = greeting.textContent.trim();
  if (!text) return;
  greeting.setAttribute("aria-label", text);
  greeting.classList.add("joy-characters-ready");
  let characterIndex = 0;
  const content = document.createDocumentFragment();
  text.split(" ").forEach((word, wordIndex, words) => {
    const wordElement = document.createElement("span");
    wordElement.className = "joy-motion-word";
    wordElement.setAttribute("aria-hidden", "true");
    Array.from(word).forEach((character) => {
      const characterElement = document.createElement("span");
      characterElement.className = "joy-motion-character";
      characterElement.style.setProperty("--joy-character-index", characterIndex);
      characterElement.textContent = character;
      wordElement.append(characterElement);
      characterIndex += 1;
    });
    content.append(wordElement);
    if (wordIndex < words.length - 1) content.append(document.createTextNode(" "));
  });
  greeting.replaceChildren(content);
}

financePrivacyToggle?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setFinancePrivacy(!financeValuesHidden, { announce: true });
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && !financeValuesHidden) setFinancePrivacy(true);
});

setFinancePrivacy(true);
animateGreetingCharacters();
loadFinance();
