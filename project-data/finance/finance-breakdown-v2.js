(() => {
  if (typeof renderMonthView !== "function") return;

  const BREAKDOWN_START = "2026-08";
  const originalRenderMonthView = renderMonthView;
  let activeView = "overview";
  let selectedLeaf = null;

  function canUseBreakdown() {
    return String(selectedMonth || "") >= BREAKDOWN_START;
  }

  function switcher(active) {
    return `<div class="finance-month-view-switcher">
      <div>
        <button type="button" data-finance-month-mode="overview" class="${active === "overview" ? "is-active" : ""}">Overview</button>
        <button type="button" data-finance-month-mode="breakdown" class="${active === "breakdown" ? "is-active" : ""}" ${canUseBreakdown() ? "" : "disabled"}>Expense map</button>
      </div>
      <small>${canUseBreakdown() ? "Category → detail → transaction" : "Detailed expenses start in August 2026"}</small>
    </div>`;
  }

  function bindSwitcher(content) {
    content.querySelectorAll("[data-finance-month-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.dataset.financeMonthMode;
        if (next === "breakdown" && !canUseBreakdown()) return;
        if (next === activeView) return;
        activeView = next;
        selectedLeaf = null;
        renderMonthView(content);
      });
    });
  }

  function categoryBreakdown() {
    return (financeCategories?.expense || []).map((category) => {
      const transactions = monthTransactions.filter((transaction) => transaction.type === "expense" && transaction.category === category.id);
      const total = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
      const configured = Array.isArray(category.subcategories) ? category.subcategories : [];
      const keys = new Set(configured);
      transactions.forEach((transaction) => keys.add(String(transaction.subcategory || "")));
      const leaves = [...keys].map((key) => {
        const matching = transactions.filter((transaction) => String(transaction.subcategory || "") === key);
        return {
          key,
          label: key || (configured.length ? "Uncategorized" : "Direct spending"),
          amount: matching.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
          count: matching.length,
        };
      }).filter((leaf) => leaf.amount > 0);
      return { ...category, total, leaves };
    }).filter((category) => category.total > 0);
  }

  function renderBranch(category, total) {
    const share = total ? Math.round(category.total / total * 100) : 0;
    return `<article class="finance-map-branch" data-map-category="${escapeHtml(category.id)}">
      <header><span><b>${escapeHtml(category.label)}</b><small>${share}% of expenses</small></span><strong>${formatVnd(category.total)}</strong></header>
      <div>${category.leaves.map((leaf) => `<button type="button" data-map-leaf data-category="${escapeHtml(category.id)}" data-subcategory="${escapeHtml(leaf.key)}">
        <span><b>${escapeHtml(leaf.label)}</b><small>${leaf.count} ${leaf.count === 1 ? "entry" : "entries"}</small></span><strong>${formatVnd(leaf.amount)}</strong>
      </button>`).join("")}</div>
    </article>`;
  }

  function inspectorMarkup() {
    if (!selectedLeaf) return '<section class="finance-map-inspector is-empty">Select a detail to inspect its transactions.</section>';
    const category = financeCategories.expense.find((item) => item.id === selectedLeaf.category);
    const transactions = monthTransactions.filter((transaction) => transaction.type === "expense"
      && transaction.category === selectedLeaf.category
      && String(transaction.subcategory || "") === selectedLeaf.subcategory);
    const label = selectedLeaf.subcategory || (category?.subcategories?.length ? "Uncategorized" : "Direct spending");
    const total = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    return `<section class="finance-map-inspector" id="finance-map-inspector">
      <header><div><small>${escapeHtml(category?.label || selectedLeaf.category)}</small><h4>${escapeHtml(label)} · ${formatVnd(total)}</h4></div>
      <button type="button" data-map-add>+ Add expense</button></header>
      <div>${transactions.length ? transactions.map((transaction) => `<article>
        <time>${escapeHtml(formatDate(transaction.occurred_on))}</time>
        <span><b>${escapeHtml(transaction.note || label)}</b><small>${escapeHtml(capitalize(transaction.status || "actual"))}</small></span>
        <strong>${formatVnd(transaction.amount)}</strong>
        <button type="button" data-map-edit="${escapeHtml(transaction.id)}" aria-label="Edit transaction">✎</button>
      </article>`).join("") : '<p class="finance-empty">No matching transactions.</p>'}</div>
    </section>`;
  }

  function renderBreakdown(content) {
    const month = financeSummary.months.find((item) => item.key === selectedMonth) || financeSummary.current;
    const categories = categoryBreakdown();
    const total = categories.reduce((sum, category) => sum + category.total, 0);
    content.className = "finance-workspace-content finance-breakdown-view";
    content.innerHTML = `${switcher("breakdown")}
      <section class="finance-breakdown-hero"><div><small>Detailed expense map</small><h2>${escapeHtml(month.label)}</h2><p>Open a branch to see where each category total comes from.</p></div><div><span>Total expenses</span><strong>${formatVnd(total)}</strong><small>${monthTransactions.filter((transaction) => transaction.type === "expense").length} entries</small></div></section>
      <section class="finance-map-card"><header><div><small>Money flow</small><h3>Expense mind map</h3></div></header>
        <div class="finance-map-stage">${categories.length ? categories.map((category) => renderBranch(category, total)).join("") : '<p class="finance-map-empty">No expenses entered for this month.</p>'}</div>
      </section>${inspectorMarkup()}`;
    bindSwitcher(content);
    bindMap(content);
  }

  function bindMap(content) {
    content.querySelectorAll("[data-map-leaf]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedLeaf = { category: button.dataset.category, subcategory: button.dataset.subcategory || "" };
        content.querySelectorAll("[data-map-leaf]").forEach((leaf) => leaf.classList.toggle("is-selected", leaf === button));
        content.querySelector("#finance-map-inspector, .finance-map-inspector")?.replaceWith(elementFrom(inspectorMarkup()));
        bindInspector(content);
      });
    });
    bindInspector(content);
  }

  function bindInspector(content) {
    content.querySelector("[data-map-add]")?.addEventListener("click", () => {
      openEntryForm("expense");
      const form = document.querySelector("#finance-entry-form");
      if (!form || !selectedLeaf) return;
      form.elements.category.value = selectedLeaf.category;
      updateSubcategories(selectedLeaf.subcategory);
    });
    content.querySelectorAll("[data-map-edit]").forEach((button) => {
      button.addEventListener("click", () => editFinanceTransaction(button.dataset.mapEdit));
    });
  }

  function elementFrom(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  }

  if (typeof financeErrorMessage === "function") {
    const originalFinanceErrorMessage = financeErrorMessage;
    financeErrorMessage = (code) => {
      if (code === "FINANCE_SUBCATEGORY_REQUIRED") return "Choose a detail for this expense.";
      if (code === "FINANCE_SUBCATEGORY_INVALID") return "Choose a valid expense detail.";
      return originalFinanceErrorMessage(code);
    };
  }

  renderMonthView = function renderMonthViewWithExpenseMap(content) {
    if (!canUseBreakdown() && activeView === "breakdown") activeView = "overview";
    if (activeView === "breakdown") return renderBreakdown(content);
    originalRenderMonthView(content);
    content.insertAdjacentHTML("afterbegin", switcher("overview"));
    bindSwitcher(content);
  };
})();
