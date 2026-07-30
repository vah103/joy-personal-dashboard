const financePanel = document.querySelector("#finance");
const financeData = document.querySelector("#finance-data");
const initialPrivacyToggle = document.querySelector("[data-action='toggle-finance-privacy']");
const FINANCE_CLOUD_BACKEND = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
const FINANCE_YEAR = 2026;
const FINANCE_REVEAL_MS = 60_000;
const financeAmount = window.JoyFinanceAmount;

if (!financeAmount) {
  throw new Error("Joy Finance amount parser is not loaded");
}

const FALLBACK_CATEGORIES = {
  income: [
    { id: "sale", label: "Sale", hint: "Commission and room-closing income", subcategories: [] },
    { id: "allowance", label: "Allowance", hint: "Regular allowance received", subcategories: [] },
    { id: "carryover", label: "Carryover", hint: "Balance transferred from the previous month", subcategories: [], locked: true },
    { id: "other-income", label: "Other income", hint: "Any other money received", subcategories: [] },
  ],
  expense: [
    { id: "home", label: "House", hint: "Rent, services and household shopping", subcategories: ["Rent", "Services", "Household shopping", "Other home expense"] },
    { id: "meals", label: "Meals", hint: "Food at home, eating out and reward meals", subcategories: ["Home meals", "Eating out", "Reward after closing a room", "Other meals"] },
    { id: "transportation", label: "Transportation", hint: "Fuel, ride-hailing and other travel", subcategories: ["Fuel", "Ride-hailing", "Other transportation"] },
    { id: "clothing", label: "Clothing", hint: "Clothes, shoes and personal fashion", subcategories: [] },
    { id: "dating", label: "Dating", hint: "Spending while going out with your girlfriend", subcategories: [] },
    { id: "hanging-out", label: "Hanging out", hint: "Going out with friends or family", subcategories: ["Friends", "Family", "Other"] },
    { id: "haircare", label: "Haircare", hint: "Haircuts and hair products", subcategories: ["Haircut", "Hair products", "Other haircare"] },
    { id: "money-leaks", label: "Money leaks", hint: "Snacks, random purchases and mistakes", subcategories: ["Snacks", "Random purchases", "Mistakes", "Lost money", "Other money leaks"] },
    { id: "other", label: "Other", hint: "Expenses outside the standard categories", subcategories: [] },
  ],
};

let financeSummary = null;
let financeCategories = FALLBACK_CATEGORIES;
let selectedMonth = vietnamMonthKey();
let monthTransactions = [];
let financeValuesHidden = true;
let privacyTimer;
let workspaceView = "month";
let editingTransactionId = "";

function mountFinance() {
  if (!financePanel || !financeData) return;

  const titleLink = financePanel.querySelector(".panel-title-button");
  if (titleLink) {
    titleLink.href = "#finance";
    titleLink.removeAttribute("target");
    titleLink.removeAttribute("rel");
    titleLink.addEventListener("click", (event) => {
      event.preventDefault();
      openFinanceWorkspace("month");
    });
  }

  const headingActions = financePanel.querySelector(".finance-heading-actions");
  if (headingActions) {
    headingActions.innerHTML = `
      <span class="finance-period" id="finance-period">2026</span>
      <button class="quiet-link finance-add-expense" type="button" data-finance-add="expense">+ Expense</button>
      <button class="quiet-link" type="button" data-finance-open>View details ↗</button>
      ${initialPrivacyToggle?.outerHTML || ""}
    `;
  }

  financeData.innerHTML = `
    <div class="finance-sync-state" id="finance-sync-state" hidden></div>
    <div class="finance-overview">
      <button class="finance-available" type="button" data-finance-open>
        <span>Available this month</span>
        <strong data-finance-field="remaining" data-finance-value="0 ₫" data-finance-mask="● ● ● ●">● ● ● ●</strong>
        <small><i>↗</i><b>Actual balance</b></small>
      </button>
      <button class="finance-overview-stat" type="button" data-finance-open>
        <span class="finance-stat-icon income" aria-hidden="true">▰</span>
        <span><small>Income</small><strong data-finance-field="income" data-finance-value="0 ₫" data-finance-mask="● ● ●">● ● ●</strong><em>Includes Carryover</em></span>
      </button>
      <button class="finance-overview-stat" type="button" data-finance-open>
        <span class="finance-stat-icon expense" aria-hidden="true">↓</span>
        <span><small>Expenses</small><strong data-finance-field="expenses" data-finance-value="0 ₫" data-finance-mask="● ● ●">● ● ●</strong><em>Actual this month</em></span>
      </button>
      <button class="finance-overview-stat" type="button" data-finance-year>
        <span class="finance-stat-icon forecast" aria-hidden="true">◎</span>
        <span><small>Year-end</small><strong data-finance-field="year-end" data-finance-value="0 ₫" data-finance-mask="● ● ●">● ● ●</strong><em>Projected December balance</em></span>
      </button>
    </div>
    <div class="finance-lower-grid">
      <button class="finance-pulse" type="button" data-finance-year>
        <span class="finance-pulse-heading"><strong>2026 balance path</strong><small>Actual + planned</small></span>
        <span class="finance-chart-visual">
          <svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="finance-live-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f99a8" stop-opacity=".28"/><stop offset="1" stop-color="#6f99a8" stop-opacity="0"/></linearGradient></defs>
            <path class="finance-grid-line" d="M14 24H586M14 75H586M14 126H586M14 154H586"/>
            <path class="finance-series-area" data-finance-area d=""/>
            <polyline class="finance-series finance-series-remaining" data-finance-series="remaining" points=""/>
            <g data-finance-points></g>
          </svg>
        </span>
        <span class="finance-months" id="finance-months" aria-hidden="true"></span>
      </button>
      <div class="finance-category-card finance-month-actions-card">
        <span class="finance-pulse-heading"><strong>Monthly finance</strong><small>Quick actions</small></span>
        <div class="finance-month-action-grid">
          <button class="is-primary" type="button" data-finance-open><span>Open month</span><small>View income and expenses</small></button>
          <button type="button" data-finance-add="expense"><span>+ Expense</span><small>Record money out</small></button>
          <button type="button" data-finance-add="income"><span>+ Income</span><small>Record money in</small></button>
        </div>
      </div>
    </div>
    <p class="finance-demo-note" id="finance-source">Loading Joy Finance…</p>
  `;

  if (!document.querySelector("#finance-workspace")) {
    document.body.insertAdjacentHTML("beforeend", financeWorkspaceMarkup());
  }

  bindFinanceEvents();
  setFinancePrivacy(true);
  loadFinanceSummary();
}

function financeWorkspaceMarkup() {
  return `
    <div class="finance-workspace-backdrop" id="finance-workspace" hidden>
      <section class="finance-workspace" role="dialog" aria-modal="true" aria-labelledby="finance-workspace-title">
        <header class="finance-workspace-header">
          <div><p class="section-kicker">Joy Finance</p><h2 id="finance-workspace-title">Finance 2026</h2></div>
          <div class="finance-workspace-actions">
            <button type="button" data-finance-add="income">+ Income</button>
            <button class="primary" type="button" data-finance-add="expense">+ Expense</button>
            <button class="close" type="button" data-finance-close aria-label="Close Finance">×</button>
          </div>
        </header>
        <nav class="finance-tabs" aria-label="Finance views">
          <button class="active" type="button" data-finance-tab="month">Month</button>
          <button type="button" data-finance-tab="year">Year</button>
        </nav>
        <div class="finance-workspace-content" id="finance-workspace-content"></div>
      </section>
    </div>
    <div class="finance-entry-backdrop" id="finance-entry-modal" hidden>
      <section class="finance-entry-modal" role="dialog" aria-modal="true" aria-labelledby="finance-entry-title">
        <header>
          <div><p class="section-kicker">Joy Finance</p><h2 id="finance-entry-title">Add expense</h2></div>
          <button type="button" data-finance-entry-close aria-label="Close transaction form">×</button>
        </header>
        <form id="finance-entry-form">
          <input name="id" type="hidden">
          <input name="type" type="hidden" value="expense">
          <div class="finance-type-switch">
            <button type="button" class="active" data-entry-type="expense">Expense</button>
            <button type="button" data-entry-type="income">Income</button>
          </div>
          <label class="finance-amount-label"><span>Amount</span><div><input name="amount" type="text" inputmode="numeric" autocomplete="off" placeholder="50 = 50.000 ₫" required><b>₫</b></div></label>
          <div class="finance-form-grid">
            <label>Date<input name="occurred_on" type="date" required></label>
            <label>Status<select name="status"><option value="actual">Actual</option><option value="planned">Planned</option></select></label>
            <label>Category<select name="category" required></select></label>
            <label id="finance-subcategory-label">Detail<select name="subcategory"></select></label>
          </div>
          <label>Note<input name="note" type="text" maxlength="300" placeholder="Optional note"></label>
          <div class="finance-form-actions">
            <button type="button" class="secondary-button" data-finance-entry-close>Cancel</button>
            <button type="submit" class="primary-button">Save transaction</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function bindFinanceEvents() {
  document.querySelectorAll("[data-finance-open]").forEach((button) => button.addEventListener("click", () => openFinanceWorkspace("month")));
  document.querySelectorAll("[data-finance-year]").forEach((button) => button.addEventListener("click", () => openFinanceWorkspace("year")));
  document.querySelectorAll("[data-finance-add]").forEach((button) => button.addEventListener("click", () => openEntryForm(button.dataset.financeAdd)));
  document.querySelectorAll("[data-finance-close]").forEach((button) => button.addEventListener("click", closeFinanceWorkspace));
  document.querySelectorAll("[data-finance-entry-close]").forEach((button) => button.addEventListener("click", closeEntryForm));
  document.querySelectorAll("[data-finance-tab]").forEach((button) => button.addEventListener("click", () => switchWorkspaceView(button.dataset.financeTab)));
  document.querySelectorAll("[data-entry-type]").forEach((button) => button.addEventListener("click", () => setEntryType(button.dataset.entryType)));
  document.querySelector("#finance-entry-form")?.addEventListener("submit", saveFinanceTransaction);
  document.querySelector("#finance-entry-form [name='category']")?.addEventListener("change", () => updateSubcategories());
  document.querySelector("#finance-workspace")?.addEventListener("click", (event) => {
    if (event.target.id === "finance-workspace") closeFinanceWorkspace();
  });
  document.querySelector("#finance-entry-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "finance-entry-modal") closeEntryForm();
  });
  document.querySelector("[data-action='toggle-finance-privacy']")?.addEventListener("click", () => setFinancePrivacy(!financeValuesHidden, { announce: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") setFinancePrivacy(true);
  });
}

async function loadFinanceSummary() {
  if (!financeData) return;
  if (!FINANCE_CLOUD_BACKEND) {
    showFinanceError("Joy Finance needs the Cloudflare backend.");
    return;
  }

  try {
    const payload = await financeFetch(`/api/finance/summary?year=${FINANCE_YEAR}&month=${selectedMonth}`);
    financeSummary = payload;
    financeCategories = normalizeCategories(payload.categories || FALLBACK_CATEGORIES);
    selectedMonth = payload.selectedMonth || selectedMonth;
    renderFinanceDashboard();
    if (!document.querySelector("#finance-workspace")?.hidden) await renderFinanceWorkspace();
  } catch (error) {
    showFinanceError(error.message === "AUTH_REQUIRED" ? "Sign in to use Joy Finance." : "Joy Finance could not load.");
  }
}

function normalizeCategories(categories) {
  return {
    income: (categories.income || FALLBACK_CATEGORIES.income).map((category) => ({
      ...category,
      hint: FALLBACK_CATEGORIES.income.find((item) => item.id === category.id)?.hint || "",
      locked: category.id === "carryover",
    })),
    expense: (categories.expense || FALLBACK_CATEGORIES.expense).map((category) => ({
      ...category,
      hint: FALLBACK_CATEGORIES.expense.find((item) => item.id === category.id)?.hint || "",
    })),
  };
}

function renderFinanceDashboard() {
  const current = financeSummary?.current;
  if (!current) return;

  const values = {
    remaining: current.actual.remaining,
    income: current.actual.income,
    expenses: current.actual.expenses,
    "year-end": financeSummary.annual.projectedYearEnd,
  };
  Object.entries(values).forEach(([field, value]) => setMoneyValue(document.querySelector(`[data-finance-field="${field}"]`), value));

  const period = document.querySelector("#finance-period");
  if (period) period.textContent = current.label;
  const source = document.querySelector("#finance-source");
  if (source) source.textContent = "Joy is the source of truth · Carryover is excluded from annual income";
  document.querySelector("#finance-sync-state")?.setAttribute("hidden", "");
  renderFinanceChart(financeSummary.months || []);
  setFinancePrivacy(financeValuesHidden);
  document.dispatchEvent(new CustomEvent("joy:finance-dashboard-rendered"));
}

function renderFinanceChart(months) {
  const values = months.map((month) => Number(month.projected?.remaining || 0));
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, ...values);
  const span = maximum - minimum || 1;
  const coordinates = months.map((month, index) => ({
    x: 14 + (index / Math.max(1, months.length - 1)) * 572,
    y: 18 + ((maximum - Number(month.projected?.remaining || 0)) / span) * 118,
  }));
  const points = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  document.querySelector('[data-finance-series="remaining"]')?.setAttribute("points", points);
  const area = document.querySelector("[data-finance-area]");
  if (area && coordinates.length) {
    area.setAttribute("d", `M${coordinates[0].x.toFixed(1)} 154 ${coordinates.map(({ x, y }) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} L${coordinates.at(-1).x.toFixed(1)} 154Z`);
  }
  const group = document.querySelector("[data-finance-points]");
  if (group) {
    group.innerHTML = coordinates.map(({ x, y }, index) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${months[index]?.key === selectedMonth ? 5 : 3.5}" class="finance-point${months[index]?.key === selectedMonth ? " is-current" : ""}"></circle>`).join("");
  }
  const labels = document.querySelector("#finance-months");
  if (labels) labels.innerHTML = months.map((month) => `<i class="${month.key === selectedMonth ? "is-current" : ""}">${month.shortLabel}</i>`).join("");
  document.dispatchEvent(new CustomEvent("joy:finance-chart-rendered"));
}

async function openFinanceWorkspace(view = "month") {
  workspaceView = view === "year" ? "year" : "month";
  const workspace = document.querySelector("#finance-workspace");
  if (!workspace) return;
  workspace.hidden = false;
  document.body.classList.add("finance-modal-open");
  await renderFinanceWorkspace();
}

function closeFinanceWorkspace() {
  const workspace = document.querySelector("#finance-workspace");
  if (workspace) workspace.hidden = true;
  document.body.classList.remove("finance-modal-open");
}

function switchWorkspaceView(view) {
  workspaceView = view === "year" ? "year" : "month";
  renderFinanceWorkspace();
}

async function renderFinanceWorkspace() {
  const content = document.querySelector("#finance-workspace-content");
  if (!content) return;
  document.querySelectorAll("[data-finance-tab]").forEach((button) => button.classList.toggle("active", button.dataset.financeTab === workspaceView));

  if (!financeSummary) {
    content.innerHTML = '<p class="finance-loading">Loading Finance…</p>';
    return;
  }

  if (workspaceView === "year") {
    window.JoyFinanceLayout?.beforeYearView?.();
    renderYearView(content);
    return;
  }

  await loadMonthTransactions();
  const customMonthRenderer = window.JoyFinanceLayout?.renderMonthView;
  if (typeof customMonthRenderer === "function") customMonthRenderer(content);
  else renderMonthView(content);
}

async function loadMonthTransactions() {
  const payload = await financeFetch(`/api/finance/transactions?year=${FINANCE_YEAR}&month=${selectedMonth}`);
  monthTransactions = payload.transactions || [];
}

function renderMonthView(content) {
  const month = financeSummary.months.find((item) => item.key === selectedMonth) || financeSummary.current;
  const totals = transactionCategoryTotals(monthTransactions);
  const status = monthStatus(monthTransactions);
  const incomeTotal = Number(month.projected?.income || 0);
  const expenseTotal = Number(month.projected?.expenses || 0);
  const newIncome = Number(month.projected?.newIncome || 0);
  const closing = Number(month.projected?.remaining || 0);

  content.className = "finance-workspace-content";
  content.innerHTML = `
    <div class="finance-month-toolbar finance-ledger-month-toolbar">
      <button type="button" data-month-shift="-1" aria-label="Previous month">‹</button>
      <div><small>Monthly detail</small><strong>${escapeHtml(month.label)}</strong></div>
      <button type="button" data-month-shift="1" aria-label="Next month">›</button>
    </div>
    <section class="finance-ledger-board" aria-label="${escapeHtml(month.label)} finance overview">
      <header class="finance-ledger-hero">
        <div>
          <small>Monthly finance</small>
          <h2>${escapeHtml(month.label)}</h2>
          <p>${escapeHtml(status)} · Carryover is included in monthly income.</p>
        </div>
        <div class="finance-ledger-balance">
          <small>Closing balance</small>
          <strong>${formatVnd(closing)}</strong>
        </div>
      </header>
      <div class="finance-ledger-summary">
        <div><span>Income</span><strong>${formatVnd(incomeTotal)}</strong><small>Includes Carryover</small></div>
        <div><span>Expenses</span><strong>${formatVnd(expenseTotal)}</strong><small>Actual + planned</small></div>
        <div><span>New income</span><strong>${formatVnd(newIncome)}</strong><small>Sale, Allowance and Other</small></div>
      </div>
      <div class="finance-ledger-columns">
        ${renderLedgerColumn("Income", "Money in", incomeTotal, financeCategories.income, totals.income, "income", month)}
        ${renderLedgerColumn("Expenses", "Money out", expenseTotal, financeCategories.expense, totals.expense, "expense", month)}
      </div>
    </section>
    <section class="finance-transactions finance-ledger-transactions">
      <header><div><small>${monthTransactions.length} entries</small><h3>Transaction history</h3></div><button type="button" data-finance-add="income">+ Income</button></header>
      <div>${renderTransactions(monthTransactions)}</div>
    </section>
  `;

  content.querySelectorAll("[data-month-shift]").forEach((button) => button.addEventListener("click", () => shiftMonth(Number(button.dataset.monthShift))));
  content.querySelectorAll("[data-finance-add]").forEach((button) => button.addEventListener("click", () => openEntryForm(button.dataset.financeAdd)));
  content.querySelectorAll("[data-finance-edit]").forEach((button) => button.addEventListener("click", () => editFinanceTransaction(button.dataset.financeEdit)));
  content.querySelectorAll("[data-finance-delete]").forEach((button) => button.addEventListener("click", () => removeFinanceTransaction(button.dataset.financeDelete)));
  bindInlineCategoryForms(content);
}

function renderLedgerColumn(title, kicker, total, categories, totals, type, month) {
  return `
    <section class="finance-ledger-column ${type}">
      <header>
        <div><small>${kicker}</small><h3>${title}</h3></div>
        <strong>${formatVnd(total)}</strong>
      </header>
      <div class="finance-ledger-list">
        ${categories.map((category) => renderLedgerItem(category, Number(totals.get(category.id) || 0), type, month)).join("")}
      </div>
    </section>
  `;
}

function renderLedgerItem(category, amount, type, month) {
  const locked = Boolean(category.locked || category.id === "carryover");
  const hint = category.subcategories?.length ? category.subcategories.slice(0, 3).join(" · ") : category.hint || "";
  return `
    <div class="finance-ledger-item${locked ? " is-locked" : ""}" data-ledger-item data-type="${type}" data-category="${category.id}">
      <button class="finance-ledger-item-button" type="button" ${locked ? "disabled" : ""}>
        <span class="finance-ledger-item-mark ${type}">${type === "income" ? "+" : "−"}</span>
        <span class="finance-ledger-item-copy"><b>${escapeHtml(category.label)}</b><small>${escapeHtml(hint)}</small></span>
        <strong>${formatVnd(category.id === "carryover" ? Number(month.projected?.carryover || 0) : amount)}</strong>
        <i aria-hidden="true">⌄</i>
      </button>
      ${locked ? "" : renderInlineComposer(category, type)}
    </div>
  `;
}

function renderInlineComposer(category, type) {
  return `
    <form class="finance-ledger-composer" hidden>
      ${category.subcategories?.length ? `
        <div class="finance-ledger-subcategories" role="group" aria-label="${escapeHtml(category.label)} details">
          ${category.subcategories.map((subcategory) => `<button type="button" data-ledger-subcategory="${escapeHtml(subcategory)}">${escapeHtml(subcategory)}</button>`).join("")}
        </div>
      ` : ""}
      <div class="finance-ledger-input-row">
        <label><span>Amount</span><div><input name="amount" type="text" inputmode="numeric" autocomplete="off" placeholder="50 = 50.000 ₫" required><b>₫</b></div></label>
        <label class="finance-ledger-note-field"><span>Note</span><input name="note" type="text" maxlength="120" placeholder="Optional"></label>
        <button class="finance-ledger-add-button" type="submit">Add ${type}</button>
      </div>
      <p class="finance-ledger-composer-meta">${selectedMonth > vietnamMonthKey() ? "Planned" : "Actual"} · ${selectedMonth}</p>
      <p class="finance-ledger-error" hidden></p>
    </form>
  `;
}

function bindInlineCategoryForms(content) {
  content.querySelectorAll("[data-ledger-item]:not(.is-locked)").forEach((item) => {
    const button = item.querySelector(".finance-ledger-item-button");
    const form = item.querySelector(".finance-ledger-composer");
    if (!button || !form) return;

    button.addEventListener("click", () => {
      const willOpen = form.hidden;
      content.querySelectorAll("[data-ledger-item]").forEach((otherItem) => {
        if (otherItem === item) return;
        otherItem.classList.remove("is-open");
        const otherForm = otherItem.querySelector(".finance-ledger-composer");
        if (otherForm) otherForm.hidden = true;
      });
      form.hidden = !willOpen;
      item.classList.toggle("is-open", willOpen);
      if (willOpen) window.setTimeout(() => form.querySelector('input[name="amount"]')?.focus(), 30);
    });

    form.querySelectorAll("[data-ledger-subcategory]").forEach((chip) => {
      chip.addEventListener("click", () => {
        form.querySelectorAll("[data-ledger-subcategory]").forEach((other) => other.classList.remove("is-selected"));
        chip.classList.add("is-selected");
      });
    });

    form.addEventListener("submit", (event) => saveInlineTransaction(event, item));
  });
}

async function saveInlineTransaction(event, item) {
  event.preventDefault();
  const form = event.currentTarget;
  const amount = financeAmount.parse(form.elements.amount?.value);
  const note = String(form.elements.note?.value || "").trim();
  const selectedSubcategory = form.querySelector("[data-ledger-subcategory].is-selected")?.dataset.ledgerSubcategory || "";
  const type = item.dataset.type;
  const category = item.dataset.category;
  const config = financeCategories[type].find((entry) => entry.id === category);
  const error = form.querySelector(".finance-ledger-error");
  const submit = form.querySelector('button[type="submit"]');

  if (!Number.isFinite(amount) || amount <= 0) {
    showInlineError(error, "Enter an amount greater than 0.");
    return;
  }
  if (config?.subcategories?.length && !selectedSubcategory) {
    showInlineError(error, "Choose a detail first.");
    return;
  }

  const currentMonth = vietnamMonthKey();
  const occurredOn = selectedMonth === currentMonth ? vietnamDate() : `${selectedMonth}-01`;
  const status = selectedMonth > currentMonth ? "planned" : "actual";
  submit.disabled = true;
  submit.textContent = "Saving…";
  if (error) error.hidden = true;

  try {
    await financeFetch("/api/finance/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, category, subcategory: selectedSubcategory, amount, occurred_on: occurredOn, status, note }),
    });
    showFinanceToast("Transaction added");
    await loadFinanceSummary();
  } catch {
    showInlineError(error, "Joy could not save this transaction.");
    submit.disabled = false;
    submit.textContent = `Add ${type}`;
  }
}

function showInlineError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
}

function transactionCategoryTotals(transactions) {
  const income = new Map(financeCategories.income.map((category) => [category.id, 0]));
  const expense = new Map(financeCategories.expense.map((category) => [category.id, 0]));
  for (const transaction of transactions) {
    const map = transaction.type === "income" ? income : expense;
    map.set(transaction.category, Number(map.get(transaction.category) || 0) + Number(transaction.amount || 0));
  }
  return { income, expense };
}

function monthStatus(transactions) {
  const actual = transactions.some((transaction) => transaction.status === "actual");
  const planned = transactions.some((transaction) => transaction.status === "planned");
  if (actual && planned) return "Actual + planned";
  if (planned) return "Planned";
  return "Actual";
}

function renderYearView(content) {
  const annual = financeSummary.annual;
  content.className = "finance-workspace-content finance-ledger-year-view";
  content.innerHTML = `
    <div class="finance-year-hero"><div><small>Projected December balance</small><strong>${formatVnd(annual.projectedYearEnd)}</strong><p>Carryover remains visible each month, but is excluded from annual income.</p></div></div>
    <div class="finance-detail-cards finance-annual-cards">
      ${detailCard("Annual income", annual.projectedIncome, "Excludes Carryover")}
      ${detailCard("Annual expenses", annual.projectedExpenses, "Actual + planned")}
      ${detailCard("Current balance", annual.currentBalance, "Actual through the current month")}
    </div>
    <div class="finance-year-table">
      <div class="finance-year-row head"><span>Month</span><span>Carryover</span><span>New income</span><span>Expenses</span><span>Closing</span><span>Status</span></div>
      ${financeSummary.months.map((month) => `
        <button class="finance-year-row" type="button" data-year-month="${month.key}">
          <span><b>${month.shortLabel}</b><small>${month.label.split(" ")[1]}</small></span>
          <span>${formatVnd(month.projected.carryover)}</span>
          <span>${formatVnd(month.projected.newIncome)}</span>
          <span>${formatVnd(month.projected.expenses)}</span>
          <span>${formatVnd(month.projected.remaining)}</span>
          <span class="finance-status ${month.status}">${month.status === "in-progress" ? "In progress" : capitalize(month.status)}</span>
        </button>
      `).join("")}
    </div>
  `;

  content.querySelectorAll("[data-year-month]").forEach((button) => button.addEventListener("click", async () => {
    selectedMonth = button.dataset.yearMonth;
    workspaceView = "month";
    await loadFinanceSummary();
  }));
}

function detailCard(label, amount, note) {
  return `<article><small>${label}</small><strong>${formatVnd(amount)}</strong><p>${note}</p></article>`;
}

function renderTransactions(transactions) {
  if (!transactions.length) return '<p class="finance-empty">No transactions yet. Add the first one directly in Joy.</p>';
  return transactions.map((transaction) => {
    const category = categoryLabel(transaction.type, transaction.category);
    const detail = [transaction.subcategory, transaction.note].filter(Boolean).join(" · ");
    const sign = transaction.type === "income" ? "+" : "−";
    return `
      <article class="finance-transaction-row">
        <button type="button" data-finance-edit="${transaction.id}">
          <i class="${transaction.type}">${sign}</i>
          <span><b>${escapeHtml(category)}</b><small>${escapeHtml(detail || formatDate(transaction.occurred_on))}</small></span>
          <strong>${sign}${formatVnd(transaction.amount)}</strong>
          <em class="finance-status ${transaction.status}">${capitalize(transaction.status)}</em>
        </button>
        <button class="finance-delete" type="button" data-finance-delete="${transaction.id}" aria-label="Delete transaction">×</button>
      </article>
    `;
  }).join("");
}

async function shiftMonth(direction) {
  const date = new Date(`${selectedMonth}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + direction);
  if (date.getUTCFullYear() !== FINANCE_YEAR) return;
  selectedMonth = `${FINANCE_YEAR}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  await loadFinanceSummary();
}

function openEntryForm(type = "expense", transaction = null) {
  const modal = document.querySelector("#finance-entry-modal");
  const form = document.querySelector("#finance-entry-form");
  if (!modal || !form) return;

  editingTransactionId = transaction?.id || "";
  form.reset();
  form.elements.id.value = editingTransactionId;
  form.elements.occurred_on.value = transaction?.occurred_on || defaultDateForSelectedMonth();
  form.elements.amount.value = transaction ? financeAmount.inputValue(transaction.amount) : "";
  form.elements.status.value = transaction?.status || (selectedMonth > vietnamMonthKey() ? "planned" : "actual");
  form.elements.note.value = transaction?.note || "";
  setEntryType(transaction?.type || type, transaction?.category, transaction?.subcategory);
  document.querySelector("#finance-entry-title").textContent = transaction ? "Edit transaction" : `Add ${type}`;
  modal.hidden = false;
  window.setTimeout(() => form.elements.amount.focus(), 30);
}

function closeEntryForm() {
  const modal = document.querySelector("#finance-entry-modal");
  if (modal) modal.hidden = true;
  editingTransactionId = "";
}

function setEntryType(type, selectedCategory = "", selectedSubcategory = "") {
  const form = document.querySelector("#finance-entry-form");
  if (!form) return;
  const safeType = type === "income" ? "income" : "expense";
  form.elements.type.value = safeType;
  document.querySelectorAll("[data-entry-type]").forEach((button) => button.classList.toggle("active", button.dataset.entryType === safeType));

  const categories = financeCategories[safeType].filter((category) => category.id !== "carryover");
  form.elements.category.innerHTML = categories.map((category) => `<option value="${category.id}">${escapeHtml(category.label)}</option>`).join("");
  form.elements.category.value = selectedCategory && categories.some((category) => category.id === selectedCategory) ? selectedCategory : categories[0].id;
  updateSubcategories(selectedSubcategory);

  const title = document.querySelector("#finance-entry-title");
  if (title && !editingTransactionId) title.textContent = `Add ${safeType}`;
}

function updateSubcategories(selected = "") {
  const form = document.querySelector("#finance-entry-form");
  if (!form) return;
  const type = form.elements.type.value;
  const category = financeCategories[type].find((item) => item.id === form.elements.category.value);
  const options = category?.subcategories || [];
  form.elements.subcategory.innerHTML = '<option value="">No detail</option>' + options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("");
  if (selected && options.includes(selected)) form.elements.subcategory.value = selected;
  document.querySelector("#finance-subcategory-label")?.classList.toggle("is-muted", !options.length);
}

async function saveFinanceTransaction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const payload = Object.fromEntries(new FormData(form));
  payload.amount = financeAmount.parse(payload.amount);
  if (!Number.isFinite(payload.amount)) {
    showFinanceToast("Enter a valid amount.");
    form.elements.amount?.focus();
    return;
  }
  submit.disabled = true;
  delete payload.id;
  const wasEditing = Boolean(editingTransactionId);

  try {
    await financeFetch(editingTransactionId ? `/api/finance/transactions/${encodeURIComponent(editingTransactionId)}` : "/api/finance/transactions", {
      method: editingTransactionId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    closeEntryForm();
    showFinanceToast(wasEditing ? "Transaction updated" : "Transaction added");
    await loadFinanceSummary();
  } catch (error) {
    showFinanceToast(financeErrorMessage(error.message));
  } finally {
    submit.disabled = false;
  }
}

function editFinanceTransaction(id) {
  const transaction = monthTransactions.find((item) => item.id === id);
  if (transaction) openEntryForm(transaction.type, transaction);
}

async function removeFinanceTransaction(id) {
  if (!window.confirm("Delete this finance transaction?")) return;
  try {
    await financeFetch(`/api/finance/transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
    showFinanceToast("Transaction deleted");
    await loadFinanceSummary();
  } catch {
    showFinanceToast("Could not delete transaction");
  }
}

function setFinancePrivacy(hidden, { announce = false } = {}) {
  financeValuesHidden = hidden;
  window.clearTimeout(privacyTimer);
  financeData?.classList.toggle("finance-values-hidden", hidden);
  const toggle = document.querySelector("[data-action='toggle-finance-privacy']");
  toggle?.setAttribute("aria-pressed", String(hidden));
  toggle?.setAttribute("aria-label", hidden ? "Show finance amounts" : "Hide finance amounts");
  financeData?.querySelectorAll("[data-finance-value]").forEach((element) => {
    element.textContent = hidden ? element.dataset.financeMask : element.dataset.financeValue;
  });
  if (!hidden) privacyTimer = window.setTimeout(() => setFinancePrivacy(true), FINANCE_REVEAL_MS);
  if (announce) showFinanceToast(hidden ? "Finance amounts hidden" : "Finance amounts visible for 60 seconds");
}

function setMoneyValue(element, amount) {
  if (!element) return;
  element.dataset.financeValue = formatCompactVnd(amount);
  element.textContent = financeValuesHidden ? element.dataset.financeMask : element.dataset.financeValue;
}

function showFinanceError(message) {
  const state = document.querySelector("#finance-sync-state");
  if (!state) return;
  state.hidden = false;
  state.innerHTML = `<strong>${escapeHtml(message)}</strong><button type="button" data-finance-retry>Try again</button>`;
  state.querySelector("[data-finance-retry]")?.addEventListener("click", loadFinanceSummary, { once: true });
  const source = document.querySelector("#finance-source");
  if (source) source.textContent = "Joy Finance unavailable";
}

async function financeFetch(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "FINANCE_REQUEST_FAILED");
  return payload;
}

function categoryLabel(type, categoryId) {
  return financeCategories[type]?.find((category) => category.id === categoryId)?.label || categoryId;
}

function defaultDateForSelectedMonth() {
  const today = vietnamDate();
  return today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`;
}

function vietnamDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function vietnamMonthKey() {
  return vietnamDate().slice(0, 7);
}

function formatCompactVnd(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(amount / 1_000_000)} tr ₫`;
  return formatVnd(amount);
}

function formatVnd(value) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} ₫`;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

function financeErrorMessage(code) {
  const messages = {
    FINANCE_AMOUNT_INVALID: "Enter a valid amount.",
    FINANCE_DATE_INVALID: "Choose a valid date.",
    FINANCE_CATEGORY_INVALID: "Choose a category.",
  };
  return messages[code] || "Joy could not save this transaction.";
}

function capitalize(value) {
  return String(value || "").replace(/(^|-)\w/g, (match) => match.replace("-", " ").toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function showFinanceToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2200);
}

mountFinance();
