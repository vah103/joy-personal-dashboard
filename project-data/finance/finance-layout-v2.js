(() => {
  const MONTHS = new Map([
    ["January", "01"], ["February", "02"], ["March", "03"], ["April", "04"],
    ["May", "05"], ["June", "06"], ["July", "07"], ["August", "08"],
    ["September", "09"], ["October", "10"], ["November", "11"], ["December", "12"],
  ]);

  const INCOME = [
    { id: "sale", label: "Sale", hint: "Commission and room-closing income", subcategories: [] },
    { id: "allowance", label: "Allowance", hint: "Regular allowance received", subcategories: [] },
    { id: "carryover", label: "Carryover", hint: "Balance transferred from the previous month", subcategories: [], locked: true },
    { id: "other-income", label: "Other income", hint: "Any other money received", subcategories: [] },
  ];

  const EXPENSES = [
    { id: "home", label: "House", hint: "Rent, services and household shopping", subcategories: ["Rent", "Services", "Household shopping", "Other home expense"] },
    { id: "meals", label: "Meals", hint: "Food at home, eating out and reward meals", subcategories: ["Home meals", "Eating out", "Reward after closing a room", "Other meals"] },
    { id: "transportation", label: "Transportation", hint: "Fuel, ride-hailing and other travel", subcategories: ["Fuel", "Ride-hailing", "Other transportation"] },
    { id: "clothing", label: "Clothing", hint: "Clothes, shoes and personal fashion", subcategories: [] },
    { id: "dating", label: "Dating", hint: "Spending while going out with your girlfriend", subcategories: [] },
    { id: "hanging-out", label: "Hanging out", hint: "Going out with friends or family", subcategories: ["Friends", "Family", "Other"] },
    { id: "haircare", label: "Haircare", hint: "Haircuts and hair products", subcategories: ["Haircut", "Hair products", "Other haircare"] },
    { id: "money-leaks", label: "Money leaks", hint: "Snacks, random purchases and mistakes", subcategories: ["Snacks", "Random purchases", "Mistakes", "Lost money", "Other money leaks"] },
    { id: "other", label: "Other", hint: "Expenses outside the standard categories", subcategories: [] },
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

  function vietnamDate() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function monthKeyFromLabel(label) {
    const [monthName, year] = String(label || "").trim().split(/\s+/);
    const month = MONTHS.get(monthName);
    return month && year ? `${year}-${month}` : "";
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
    const income = new Map(INCOME.map((item) => [item.label, 0]));
    const expenses = new Map(EXPENSES.map((item) => [item.label, 0]));
    let actual = false;
    let planned = false;

    section.querySelectorAll(".finance-transaction-row").forEach((row) => {
      const editButton = row.querySelector("[data-finance-edit]");
      const label = editButton?.querySelector("span b")?.textContent.trim() || "";
      const rawAmount = parseVnd(editButton?.querySelector("strong")?.dataset.financeValue);
      const isIncome = Boolean(editButton?.querySelector("i.income"));
      const status = editButton?.querySelector(".finance-status")?.textContent.trim().toLowerCase();

      if (status === "actual") actual = true;
      if (status === "planned") planned = true;

      if (isIncome && label !== "Carryover" && income.has(label)) {
        income.set(label, income.get(label) + rawAmount);
      } else if (!isIncome && expenses.has(label)) {
        expenses.set(label, expenses.get(label) + Math.abs(rawAmount));
      }
    });

    return {
      income,
      expenses,
      status: actual && planned ? "Actual + planned" : planned ? "Planned" : "Actual",
    };
  }

  function mapTotal(map) {
    return [...map.values()].reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function categoryItemMarkup(item, amount, type, monthKey) {
    const subcategoryPreview = item.subcategories.length
      ? item.subcategories.slice(0, 3).join(" · ")
      : item.hint;
    const locked = Boolean(item.locked);

    return `
      <div class="finance-ledger-item${locked ? " is-locked" : ""}" data-ledger-item data-type="${type}" data-category="${item.id}">
        <button class="finance-ledger-item-button" type="button" ${locked ? "disabled" : ""}>
          <span class="finance-ledger-item-mark ${type}">${type === "income" ? "+" : "−"}</span>
          <span class="finance-ledger-item-copy">
            <b>${escapeHtml(item.label)}</b>
            <small>${escapeHtml(subcategoryPreview)}</small>
          </span>
          <strong>${formatVnd(amount)}</strong>
          <i aria-hidden="true">⌄</i>
        </button>
        ${locked ? "" : composerMarkup(item, type, monthKey)}
      </div>
    `;
  }

  function composerMarkup(item, type, monthKey) {
    const future = monthKey > vietnamDate().slice(0, 7);
    return `
      <form class="finance-ledger-composer" hidden>
        ${item.subcategories.length ? `
          <div class="finance-ledger-subcategories" role="group" aria-label="${escapeHtml(item.label)} details">
            ${item.subcategories.map((subcategory) => `<button type="button" data-ledger-subcategory="${escapeHtml(subcategory)}">${escapeHtml(subcategory)}</button>`).join("")}
          </div>
        ` : ""}
        <div class="finance-ledger-input-row">
          <label>
            <span>Amount</span>
            <div><input type="number" min="1" step="1000" inputmode="numeric" placeholder="0" required><b>₫</b></div>
          </label>
          <label class="finance-ledger-note-field">
            <span>Note</span>
            <input type="text" maxlength="120" placeholder="Optional">
          </label>
          <button class="finance-ledger-add-button" type="submit">Add ${type}</button>
        </div>
        <p class="finance-ledger-composer-meta">${future ? "Planned" : "Actual"} · ${monthKey}</p>
        <p class="finance-ledger-error" hidden></p>
      </form>
    `;
  }

  function ledgerColumnMarkup(title, total, items, totals, type, monthKey) {
    return `
      <section class="finance-ledger-column ${type}">
        <header>
          <div><small>${type === "income" ? "Money in" : "Money out"}</small><h3>${title}</h3></div>
          <strong>${formatVnd(total)}</strong>
        </header>
        <div class="finance-ledger-list">
          ${items.map((item) => categoryItemMarkup(item, totals.get(item.label) || 0, type, monthKey)).join("")}
        </div>
      </section>
    `;
  }

  function ledgerMarkup({ monthLabel, monthKey, carryover, totals }) {
    totals.income.set("Carryover", carryover);
    const newIncome = mapTotal(totals.income) - carryover;
    const income = carryover + newIncome;
    const expenses = mapTotal(totals.expenses);
    const closing = income - expenses;

    return `
      <section class="finance-ledger-board" aria-label="${escapeHtml(monthLabel)} finance overview">
        <header class="finance-ledger-hero">
          <div>
            <small>Monthly finance</small>
            <h2>${escapeHtml(monthLabel)}</h2>
            <p>${escapeHtml(totals.status)} · Carryover is included in monthly income.</p>
          </div>
          <div class="finance-ledger-balance">
            <small>Closing balance</small>
            <strong>${formatVnd(closing)}</strong>
          </div>
        </header>
        <div class="finance-ledger-summary">
          <div><span>Income</span><strong>${formatVnd(income)}</strong><small>Includes Carryover</small></div>
          <div><span>Expenses</span><strong>${formatVnd(expenses)}</strong><small>Actual + planned</small></div>
          <div><span>New income</span><strong>${formatVnd(newIncome)}</strong><small>Sale, Allowance and Other</small></div>
        </div>
        <div class="finance-ledger-columns">
          ${ledgerColumnMarkup("Income", income, INCOME, totals.income, "income", monthKey)}
          ${ledgerColumnMarkup("Expenses", expenses, EXPENSES, totals.expenses, "expense", monthKey)}
        </div>
      </section>
    `;
  }

  function keepTransactionAmountsVisible(section) {
    section.querySelectorAll("[data-finance-value]").forEach((element) => {
      const value = element.dataset.financeValue;
      if (value) element.textContent = value;
      element.removeAttribute("data-finance-value");
      element.removeAttribute("data-finance-mask");
    });
  }

  function closeOtherComposers(board, currentItem) {
    board.querySelectorAll("[data-ledger-item]").forEach((item) => {
      if (item === currentItem) return;
      item.classList.remove("is-open");
      const composer = item.querySelector(".finance-ledger-composer");
      if (composer) composer.hidden = true;
    });
  }

  function bindLedgerBoard(board) {
    board.querySelectorAll("[data-ledger-item]:not(.is-locked)").forEach((item) => {
      const button = item.querySelector(".finance-ledger-item-button");
      const composer = item.querySelector(".finance-ledger-composer");
      if (!button || !composer) return;

      button.addEventListener("click", () => {
        const willOpen = composer.hidden;
        closeOtherComposers(board, item);
        composer.hidden = !willOpen;
        item.classList.toggle("is-open", willOpen);
        if (willOpen) window.setTimeout(() => composer.querySelector('input[type="number"]')?.focus(), 40);
      });

      composer.querySelectorAll("[data-ledger-subcategory]").forEach((chip) => {
        chip.addEventListener("click", () => {
          composer.querySelectorAll("[data-ledger-subcategory]").forEach((other) => other.classList.remove("is-selected"));
          chip.classList.add("is-selected");
        });
      });

      composer.addEventListener("submit", (event) => saveInlineTransaction(event, item));
    });
  }

  async function saveInlineTransaction(event, item) {
    event.preventDefault();
    const form = event.currentTarget;
    const amountInput = form.querySelector('input[type="number"]');
    const noteInput = form.querySelector('.finance-ledger-note-field input');
    const selectedSubcategory = form.querySelector("[data-ledger-subcategory].is-selected")?.dataset.ledgerSubcategory || "";
    const error = form.querySelector(".finance-ledger-error");
    const submit = form.querySelector('button[type="submit"]');
    const monthKey = form.closest(".finance-ledger-board")?.dataset.monthKey || document.querySelector(".finance-ledger-board")?.dataset.monthKey || "";
    const amount = Number(amountInput?.value || 0);
    const type = item.dataset.type;
    const category = item.dataset.category;
    const categoryConfig = (type === "income" ? INCOME : EXPENSES).find((entry) => entry.id === category);

    if (!amount || amount <= 0) {
      showComposerError(error, "Enter an amount greater than 0.");
      return;
    }
    if (categoryConfig?.subcategories.length && !selectedSubcategory) {
      showComposerError(error, "Choose a detail first.");
      return;
    }

    const currentMonth = vietnamDate().slice(0, 7);
    const occurredOn = monthKey === currentMonth ? vietnamDate() : `${monthKey}-01`;
    const status = monthKey > currentMonth ? "planned" : "actual";
    submit.disabled = true;
    submit.textContent = "Saving…";
    if (error) error.hidden = true;

    try {
      const response = await fetch("/api/finance/transactions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          type,
          category,
          subcategory: selectedSubcategory,
          amount,
          occurred_on: occurredOn,
          status,
          note: noteInput?.value.trim() || "",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "FINANCE_REQUEST_FAILED");
      showToast("Transaction added");
      document.querySelector('[data-finance-tab="month"]')?.click();
    } catch {
      showComposerError(error, "Joy could not save this transaction.");
      submit.disabled = false;
      submit.textContent = `Add ${type}`;
    }
  }

  function showComposerError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 2200);
  }

  function rebuildMonth(content) {
    if (content.querySelector(".finance-ledger-board")) return;

    const toolbar = content.querySelector(".finance-month-toolbar");
    const transactionsSection = content.querySelector(".finance-transactions");
    const monthLabel = toolbar?.querySelector("strong")?.textContent.trim() || "";
    const monthKey = monthKeyFromLabel(monthLabel);
    const values = detailValues(content);
    if (!toolbar || !transactionsSection || !monthLabel || !monthKey || !values.size) return;

    const totals = transactionTotals(transactionsSection);
    const holder = document.createElement("div");
    holder.innerHTML = ledgerMarkup({
      monthLabel,
      monthKey,
      carryover: values.get("Carryover") || 0,
      totals,
    });
    const board = holder.firstElementChild;
    if (!board) return;
    board.dataset.monthKey = monthKey;
    bindLedgerBoard(board);

    toolbar.classList.add("finance-ledger-month-toolbar");
    transactionsSection.classList.add("finance-ledger-transactions");
    const transactionTitle = transactionsSection.querySelector("h3");
    if (transactionTitle) transactionTitle.textContent = "Transaction history";
    keepTransactionAmountsVisible(transactionsSection);

    content.classList.remove("finance-values-hidden");
    content.replaceChildren(toolbar, board, transactionsSection);
  }

  function styleYear(content) {
    content.classList.add("finance-ledger-year-view");
    content.querySelectorAll("[data-finance-value]").forEach((element) => {
      if (element.dataset.financeValue) element.textContent = element.dataset.financeValue;
    });
  }

  function replaceDashboardRanking() {
    const card = document.querySelector(".finance-category-card");
    if (!card || card.dataset.financeLedgerActions === "true") return;
    card.dataset.financeLedgerActions = "true";
    card.classList.add("finance-month-actions-card");
    card.innerHTML = `
      <span class="finance-pulse-heading"><strong>Monthly finance</strong><small>Quick actions</small></span>
      <div class="finance-month-action-grid">
        <button class="is-primary" type="button" data-ledger-dashboard="month"><span>Open month</span><small>View income and expenses</small></button>
        <button type="button" data-ledger-dashboard="expense"><span>+ Expense</span><small>Record money out</small></button>
        <button type="button" data-ledger-dashboard="income"><span>+ Income</span><small>Record money in</small></button>
      </div>
    `;
    card.querySelector('[data-ledger-dashboard="month"]')?.addEventListener("click", () => document.querySelector("[data-finance-open]")?.click());
    card.querySelector('[data-ledger-dashboard="expense"]')?.addEventListener("click", () => document.querySelector('[data-finance-add="expense"]')?.click());
    card.querySelector('[data-ledger-dashboard="income"]')?.addEventListener("click", () => {
      document.querySelector("[data-finance-open]")?.click();
      window.setTimeout(() => document.querySelector('#finance-workspace [data-finance-add="income"]')?.click(), 0);
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
