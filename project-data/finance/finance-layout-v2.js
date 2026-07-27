(() => {
  const YEAR = 2026;
  const INCOME = [
    ["sale", "Sale"],
    ["allowance", "Allowance"],
    ["carryover", "Carryover"],
    ["other-income", "Other income"],
  ];
  const EXPENSES = [
    ["home", "House"],
    ["meals", "Meals"],
    ["transportation", "Transportation"],
    ["clothing", "Clothing"],
    ["dating", "Dating"],
    ["hanging-out", "Hanging out"],
    ["haircare", "Haircare"],
    ["money-leaks", "Money leaks"],
    ["other", "Other"],
  ];
  const MONTHS = new Map([
    ["January", "01"], ["February", "02"], ["March", "03"], ["April", "04"],
    ["May", "05"], ["June", "06"], ["July", "07"], ["August", "08"],
    ["September", "09"], ["October", "10"], ["November", "11"], ["December", "12"],
  ]);

  let queued = false;
  let requestVersion = 0;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function formatVnd(value) {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} ₫`;
  }

  function monthKeyFromHeading() {
    const text = document.querySelector("#finance-workspace-content .finance-month-toolbar strong")?.textContent.trim() || "";
    const [monthName, year] = text.split(/\s+/);
    const month = MONTHS.get(monthName);
    return month && Number(year) === YEAR ? `${YEAR}-${month}` : "";
  }

  async function getJson(path) {
    const response = await fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "FINANCE_REQUEST_FAILED");
    return payload;
  }

  function categoryTotal(transactions, type, category) {
    return transactions
      .filter((item) => item.type === type && item.category === category)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

  function statusText(transactions) {
    const planned = transactions.some((item) => item.status === "planned");
    const actual = transactions.some((item) => item.status === "actual");
    if (planned && actual) return "Actual + planned";
    if (planned) return "Planned";
    return "Actual";
  }

  function rowCell(label, value, side, empty = false) {
    return `
      <div class="finance-sheet-cell finance-sheet-label ${side}${empty ? " is-empty" : ""}">${empty ? "" : escapeHtml(label)}</div>
      <div class="finance-sheet-cell finance-sheet-value ${side}${Number(value) === 0 ? " is-zero" : ""}${empty ? " is-empty" : ""}">${empty ? "" : formatVnd(value)}</div>
    `;
  }

  function ledgerRows(month, transactions) {
    const incomeRows = INCOME.map(([id, label]) => ({
      label,
      value: id === "carryover" ? Number(month.projected.carryover || 0) : categoryTotal(transactions, "income", id),
    }));
    const expenseRows = EXPENSES.map(([id, label]) => ({ label, value: categoryTotal(transactions, "expense", id) }));
    const length = Math.max(incomeRows.length, expenseRows.length);

    return Array.from({ length }, (_, index) => {
      const income = incomeRows[index];
      const expense = expenseRows[index];
      return `
        <div class="finance-sheet-ledger-row">
          ${income ? rowCell(income.label, income.value, "income") : rowCell("", 0, "income", true)}
          ${expense ? rowCell(expense.label, expense.value, "expense") : rowCell("", 0, "expense", true)}
        </div>
      `;
    }).join("");
  }

  function sheetMarkup(month, transactions) {
    return `
      <section class="finance-sheet-board" aria-label="${escapeHtml(month.label)} finance table">
        <div class="finance-sheet-title-row">
          <div class="finance-sheet-month-name">${escapeHtml(month.label)}</div>
          <div class="finance-sheet-closing-label">Closing balance</div>
          <div class="finance-sheet-closing-value">${formatVnd(month.projected.remaining)}</div>
        </div>
        <div class="finance-sheet-summary-row">
          <div>Income</div>
          <strong>${formatVnd(month.projected.income)}</strong>
          <div>Expenses</div>
          <strong>${formatVnd(month.projected.expenses)}</strong>
        </div>
        <div class="finance-sheet-section-row">
          <div><span>Income details</span><button type="button" data-sheet-add="income">+ Add</button></div>
          <div><span>Expense categories</span><button type="button" data-sheet-add="expense">+ Add</button></div>
        </div>
        <div class="finance-sheet-ledger">${ledgerRows(month, transactions)}</div>
        <footer class="finance-sheet-footnote">
          <span>${statusText(transactions)}</span>
          <span>Carryover is included in monthly Income but excluded from annual income.</span>
        </footer>
      </section>
    `;
  }

  function triggerAdd(type) {
    document.querySelector(`#finance-workspace [data-finance-add="${type}"]`)?.click();
  }

  async function rebuildMonth(content) {
    const toolbar = content.querySelector(".finance-month-toolbar");
    const transactionsSection = content.querySelector(".finance-transactions");
    const key = monthKeyFromHeading();
    if (!toolbar || !transactionsSection || !key) return;
    if (content.dataset.sheetMonth === key && content.querySelector(".finance-sheet-board")) {
      revealAmounts(content);
      return;
    }

    const version = ++requestVersion;
    try {
      const [summary, ledger] = await Promise.all([
        getJson(`/api/finance/summary?year=${YEAR}&month=${key}`),
        getJson(`/api/finance/transactions?year=${YEAR}&month=${key}`),
      ]);
      if (version !== requestVersion || !content.isConnected) return;
      const month = summary.months?.find((item) => item.key === key) || summary.current;
      const transactions = ledger.transactions || [];
      const holder = document.createElement("div");
      holder.innerHTML = sheetMarkup(month, transactions);
      const board = holder.firstElementChild;
      board.querySelector('[data-sheet-add="income"]')?.addEventListener("click", () => triggerAdd("income"));
      board.querySelector('[data-sheet-add="expense"]')?.addEventListener("click", () => triggerAdd("expense"));

      toolbar.classList.add("finance-sheet-month-toolbar");
      transactionsSection.classList.add("finance-sheet-transactions");
      const transactionTitle = transactionsSection.querySelector("h3");
      if (transactionTitle) transactionTitle.textContent = "Transaction history";
      content.replaceChildren(toolbar, board, transactionsSection);
      content.dataset.sheetMonth = key;
      revealAmounts(content);
    } catch {
      content.dataset.sheetMonth = "";
    }
  }

  function revealAmounts(content) {
    content.classList.remove("finance-values-hidden");
    content.querySelectorAll("[data-finance-value]").forEach((element) => {
      if (element.dataset.financeValue) element.textContent = element.dataset.financeValue;
    });
  }

  function styleYear(content) {
    content.classList.add("finance-sheet-year-view");
    content.querySelector(".finance-annual-cards")?.classList.remove("finance-bento-annual");
    revealAmounts(content);
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
