(() => {
  const INCOME = ["Sale", "Allowance", "Carryover", "Other income"];
  const EXPENSES = [
    "House",
    "Meals",
    "Transportation",
    "Clothing",
    "Dating",
    "Hanging out",
    "Haircare",
    "Money leaks",
    "Other",
  ];

  let queued = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function parseVnd(value) {
    const text = String(value || "");
    const digits = text.replace(/[^\d]/g, "");
    const amount = Number(digits || 0);
    return /[-−]/.test(text) ? -amount : amount;
  }

  function formatVnd(value) {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} ₫`;
  }

  function detailValues(content) {
    const values = new Map();
    content.querySelectorAll(".finance-detail-cards article").forEach((article) => {
      const label = article.querySelector("small")?.textContent.trim();
      const amount = article.querySelector("strong")?.dataset.financeValue;
      if (label) values.set(label, parseVnd(amount));
    });
    return values;
  }

  function transactionTotals(section) {
    const income = new Map(INCOME.map((label) => [label, 0]));
    const expenses = new Map(EXPENSES.map((label) => [label, 0]));
    let actual = false;
    let planned = false;

    section.querySelectorAll(".finance-transaction-row").forEach((row) => {
      const editButton = row.querySelector("[data-finance-edit]");
      const label = editButton?.querySelector("span b")?.textContent.trim() || "";
      const amount = Math.abs(parseVnd(editButton?.querySelector("strong")?.dataset.financeValue));
      const isIncome = Boolean(editButton?.querySelector("i.income"));
      const status = editButton?.querySelector(".finance-status")?.textContent.trim().toLowerCase();

      if (status === "actual") actual = true;
      if (status === "planned") planned = true;

      if (isIncome && label !== "Carryover" && income.has(label)) {
        income.set(label, income.get(label) + amount);
      } else if (!isIncome && expenses.has(label)) {
        expenses.set(label, expenses.get(label) + amount);
      }
    });

    return {
      income,
      expenses,
      status: actual && planned ? "Actual + planned" : planned ? "Planned" : "Actual",
    };
  }

  function rowCell(label, value, side, empty = false) {
    return `
      <div class="finance-sheet-cell finance-sheet-label ${side}${empty ? " is-empty" : ""}">${empty ? "" : escapeHtml(label)}</div>
      <div class="finance-sheet-cell finance-sheet-value ${side}${Number(value) === 0 ? " is-zero" : ""}${empty ? " is-empty" : ""}">${empty ? "" : formatVnd(value)}</div>
    `;
  }

  function ledgerRows(totals, carryover) {
    totals.income.set("Carryover", carryover);
    const length = Math.max(INCOME.length, EXPENSES.length);
    return Array.from({ length }, (_, index) => {
      const incomeLabel = INCOME[index];
      const expenseLabel = EXPENSES[index];
      return `
        <div class="finance-sheet-ledger-row">
          ${incomeLabel ? rowCell(incomeLabel, totals.income.get(incomeLabel), "income") : rowCell("", 0, "income", true)}
          ${expenseLabel ? rowCell(expenseLabel, totals.expenses.get(expenseLabel), "expense") : rowCell("", 0, "expense", true)}
        </div>
      `;
    }).join("");
  }

  function sheetMarkup({ monthLabel, carryover, newIncome, expenses, closing, totals }) {
    return `
      <section class="finance-sheet-board" aria-label="${escapeHtml(monthLabel)} finance table">
        <div class="finance-sheet-title-row">
          <div class="finance-sheet-month-name">${escapeHtml(monthLabel)}</div>
          <div class="finance-sheet-closing-label">Closing balance</div>
          <div class="finance-sheet-closing-value">${formatVnd(closing)}</div>
        </div>
        <div class="finance-sheet-summary-row">
          <div>Income</div>
          <strong>${formatVnd(carryover + newIncome)}</strong>
          <div>Expenses</div>
          <strong>${formatVnd(expenses)}</strong>
        </div>
        <div class="finance-sheet-section-row">
          <div><span>Income details</span><button type="button" data-sheet-add="income">+ Add</button></div>
          <div><span>Expense categories</span><button type="button" data-sheet-add="expense">+ Add</button></div>
        </div>
        <div class="finance-sheet-ledger">${ledgerRows(totals, carryover)}</div>
        <footer class="finance-sheet-footnote">
          <span>${escapeHtml(totals.status)}</span>
          <span>Carryover is included in monthly Income but excluded from annual income.</span>
        </footer>
      </section>
    `;
  }

  function triggerAdd(type) {
    document.querySelector(`#finance-workspace [data-finance-add="${type}"]`)?.click();
  }

  function keepTransactionAmountsVisible(section) {
    section.querySelectorAll("[data-finance-value]").forEach((element) => {
      const value = element.dataset.financeValue;
      if (value) element.textContent = value;
      element.removeAttribute("data-finance-value");
      element.removeAttribute("data-finance-mask");
    });
  }

  function rebuildMonth(content) {
    if (content.querySelector(".finance-sheet-board")) return;

    const toolbar = content.querySelector(".finance-month-toolbar");
    const transactionsSection = content.querySelector(".finance-transactions");
    const monthLabel = toolbar?.querySelector("strong")?.textContent.trim() || "";
    const values = detailValues(content);
    if (!toolbar || !transactionsSection || !monthLabel || !values.size) return;

    const totals = transactionTotals(transactionsSection);
    const holder = document.createElement("div");
    holder.innerHTML = sheetMarkup({
      monthLabel,
      carryover: values.get("Carryover") || 0,
      newIncome: values.get("New income") || 0,
      expenses: values.get("Expenses") || 0,
      closing: values.get("Closing balance") || 0,
      totals,
    });
    const board = holder.firstElementChild;
    if (!board) return;

    board.querySelector('[data-sheet-add="income"]')?.addEventListener("click", () => triggerAdd("income"));
    board.querySelector('[data-sheet-add="expense"]')?.addEventListener("click", () => triggerAdd("expense"));

    toolbar.classList.add("finance-sheet-month-toolbar");
    transactionsSection.classList.add("finance-sheet-transactions");
    const transactionTitle = transactionsSection.querySelector("h3");
    if (transactionTitle) transactionTitle.textContent = "Transaction history";
    keepTransactionAmountsVisible(transactionsSection);

    content.classList.remove("finance-values-hidden");
    content.replaceChildren(toolbar, board, transactionsSection);
    content.dataset.sheetMonth = monthLabel;
  }

  function styleYear(content) {
    content.classList.add("finance-sheet-year-view");
    content.querySelectorAll("[data-finance-value]").forEach((element) => {
      if (element.dataset.financeValue) element.textContent = element.dataset.financeValue;
    });
  }

  function replaceDashboardRanking() {
    const card = document.querySelector(".finance-category-card");
    if (!card || card.dataset.financeSheetActions === "true") return;
    card.dataset.financeSheetActions = "true";
    card.classList.add("finance-month-actions-card");
    card.innerHTML = `
      <span class="finance-pulse-heading"><strong>Monthly finance</strong><small>Quick actions</small></span>
      <div class="finance-month-action-grid">
        <button class="is-primary" type="button" data-sheet-dashboard="month"><span>Open month</span><small>View the finance table</small></button>
        <button type="button" data-sheet-dashboard="expense"><span>+ Expense</span><small>Record money out</small></button>
        <button type="button" data-sheet-dashboard="income"><span>+ Income</span><small>Record money in</small></button>
      </div>
    `;
    card.querySelector('[data-sheet-dashboard="month"]')?.addEventListener("click", () => document.querySelector("[data-finance-open]")?.click());
    card.querySelector('[data-sheet-dashboard="expense"]')?.addEventListener("click", () => document.querySelector('[data-finance-add="expense"]')?.click());
    card.querySelector('[data-sheet-dashboard="income"]')?.addEventListener("click", () => {
      document.querySelector("[data-finance-open]")?.click();
      setTimeout(() => triggerAdd("income"), 0);
    });
  }

  function transform() {
    queued = false;
    replaceDashboardRanking();
    const content = document.querySelector("#finance-workspace-content");
    if (!content) return;
    if (content.querySelector(".finance-year-table")) styleYear(content);
    else if (content.querySelector(".finance-month-toolbar")) rebuildMonth(content);
  }

  function queueTransform() {
    if (queued) return;
    queued = true;
    queueMicrotask(transform);
  }

  new MutationObserver(queueTransform).observe(document.documentElement, { childList: true, subtree: true });
  queueTransform();
})();
