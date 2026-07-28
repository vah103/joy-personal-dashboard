(() => {
  if (typeof renderMonthView !== "function") return;

  const BREAKDOWN_CUTOFF_MONTH = "2026-08";
  const originalRenderMonthView = renderMonthView;
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let activeFinanceMonthView = "overview";
  let selectedBreakdownLeaf = null;

  function installFinanceBreakdownStyles() {
    if (document.querySelector("#joy-finance-breakdown-v1-style")) return;
    const link = document.createElement("link");
    link.id = "joy-finance-breakdown-v1-style";
    link.rel = "stylesheet";
    link.href = "project-data/finance/finance-breakdown-v1.css?v=joy-finance-breakdown-v1";
    document.head.append(link);
  }

  function canShowBreakdown(monthKey = selectedMonth) {
    return String(monthKey || "") >= BREAKDOWN_CUTOFF_MONTH;
  }

  function viewSwitcherMarkup(active, enabled) {
    return `
      <div class="finance-month-view-switcher" data-finance-month-switcher>
        <div>
          <button class="${active === "overview" ? "is-active" : ""}" type="button" data-finance-month-view="overview">Overview</button>
          <button class="${active === "breakdown" ? "is-active" : ""}" type="button" data-finance-month-view="breakdown" ${enabled ? "" : "disabled"}>Expense map</button>
        </div>
        <small>${enabled ? "Explore category and subcategory spending" : "Detailed expense tracking starts in August 2026"}</small>
      </div>
    `;
  }

  function bindViewSwitcher(content) {
    content.querySelectorAll("[data-finance-month-view]").forEach((button) => {
      button.addEventListener("click", () => transitionFinanceMonthView(content, button.dataset.financeMonthView));
    });
  }

  function transitionFinanceMonthView(content, nextView) {
    const safeView = nextView === "breakdown" && canShowBreakdown() ? "breakdown" : "overview";
    if (safeView === activeFinanceMonthView) return;

    const visible = content.querySelector(".finance-month-split,.finance-breakdown-shell");
    const apply = () => {
      activeFinanceMonthView = safeView;
      selectedBreakdownLeaf = null;
      renderMonthView(content);
    };

    if (!visible || prefersReducedMotion?.matches || typeof visible.animate !== "function") {
      apply();
      return;
    }

    visible.animate([
      { opacity: 1, transform: "translateX(0)" },
      { opacity: 0, transform: safeView === "breakdown" ? "translateX(-24px)" : "translateX(24px)" },
    ], { duration: 170, easing: "ease-in", fill: "forwards" }).finished.then(apply, apply);
  }

  function syncBreakdownMonthNavigation(month) {
    const workspace = document.querySelector("#finance-workspace");
    const tabs = workspace?.querySelector(".finance-tabs");
    if (!workspace || !tabs) return;

    workspace.classList.add("finance-month-layout-active");
    let navigation = tabs.querySelector(".finance-tab-month-nav");
    if (!navigation) {
      navigation = document.createElement("div");
      navigation.className = "finance-tab-month-nav";
      navigation.setAttribute("aria-label", "Select Finance month");
      tabs.append(navigation);
    }

    const months = Array.isArray(financeSummary?.months) ? financeSummary.months : [];
    const monthIndex = months.findIndex((item) => item.key === month.key);
    navigation.innerHTML = `
      <button type="button" data-breakdown-month-shift="-1" aria-label="Previous month" ${monthIndex <= 0 ? "disabled" : ""}>‹</button>
      <strong aria-live="polite">${escapeHtml(month.label)}</strong>
      <button type="button" data-breakdown-month-shift="1" aria-label="Next month" ${monthIndex < 0 || monthIndex >= months.length - 1 ? "disabled" : ""}>›</button>
    `;
    navigation.querySelectorAll("[data-breakdown-month-shift]").forEach((button) => {
      button.addEventListener("click", () => shiftMonth(Number(button.dataset.breakdownMonthShift)));
    });
  }

  function expenseBreakdown(transactions) {
    const categories = Array.isArray(financeCategories?.expense) ? financeCategories.expense : [];
    return categories.map((category) => {
      const categoryTransactions = transactions.filter((transaction) => transaction.type === "expense" && transaction.category === category.id);
      const total = categoryTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
      const configured = Array.isArray(category.subcategories) ? category.subcategories : [];
      const leafKeys = new Set(configured);
      categoryTransactions.forEach((transaction) => leafKeys.add(String(transaction.subcategory || "")));

      let leaves = [...leafKeys].map((subcategory) => {
        const matching = categoryTransactions.filter((transaction) => String(transaction.subcategory || "") === subcategory);
        const amount = matching.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
        return {
          key: subcategory,
          label: subcategory || (configured.length ? "Uncategorized" : "Direct spending"),
          amount,
          transactionCount: matching.length,
        };
      }).filter((leaf) => leaf.amount > 0);

      if (!leaves.length && total > 0) {
        leaves = [{ key: "", label: configured.length ? "Uncategorized" : "Direct spending", amount: total, transactionCount: categoryTransactions.length }];
      }

      return { ...category, total, leaves };
    }).filter((category) => category.total > 0);
  }

  function splitBranches(categories) {
    const left = [];
    const right = [];
    categories.forEach((category, index) => (index % 2 === 0 ? left : right).push(category));
    return { left, right };
  }

  function renderMapBranch(category, side, index, totalExpenses) {
    const percentage = totalExpenses > 0 ? Math.round((category.total / totalExpenses) * 100) : 0;
    return `
      <article class="finance-map-branch is-${side}" data-map-category="${escapeHtml(category.id)}" style="--branch-index:${index + 1}">
        <button class="finance-map-category" type="button" data-focus-map-category="${escapeHtml(category.id)}" aria-label="Focus ${escapeHtml(category.label)}">
          <i>${side === "left" ? "←" : "→"}</i>
          <span><b>${escapeHtml(category.label)}</b><small>${percentage}% of expenses</small></span>
          <strong>${formatVnd(category.total)}</strong>
        </button>
        <div class="finance-map-leaves">
          ${category.leaves.map((leaf) => `
            <button class="finance-map-leaf" type="button" data-breakdown-category="${escapeHtml(category.id)}" data-breakdown-subcategory="${escapeHtml(leaf.key)}">
              <span><b>${escapeHtml(leaf.label)}</b><small>${leaf.transactionCount} ${leaf.transactionCount === 1 ? "entry" : "entries"}</small></span>
              <strong>${formatVnd(leaf.amount)}</strong>
            </button>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderBreakdownInspectorMarkup() {
    if (!selectedBreakdownLeaf) {
      return '<section class="finance-breakdown-inspector is-empty" id="finance-breakdown-inspector">Select a subcategory to see its transactions and add another expense.</section>';
    }

    const { category, subcategory } = selectedBreakdownLeaf;
    const categoryConfig = financeCategories.expense.find((item) => item.id === category);
    const label = subcategory || (categoryConfig?.subcategories?.length ? "Uncategorized" : "Direct spending");
    const transactions = monthTransactions.filter((transaction) => transaction.type === "expense"
      && transaction.category === category
      && String(transaction.subcategory || "") === subcategory);
    const total = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return `
      <section class="finance-breakdown-inspector" id="finance-breakdown-inspector">
        <header>
          <div><small>${escapeHtml(categoryConfig?.label || category)}</small><h4>${escapeHtml(label)} · ${formatVnd(total)}</h4></div>
          <button type="button" data-breakdown-add="${escapeHtml(category)}" data-breakdown-add-subcategory="${escapeHtml(subcategory)}">+ Add expense</button>
        </header>
        <div>
          ${transactions.length ? transactions.map((transaction) => `
            <article class="finance-breakdown-entry">
              <time>${escapeHtml(formatDate(transaction.occurred_on))}</time>
              <span><b>${escapeHtml(transaction.note || label)}</b><small>${escapeHtml(capitalize(transaction.status || "actual"))}</small></span>
              <strong>${formatVnd(transaction.amount)}</strong>
              <button type="button" data-breakdown-edit="${escapeHtml(transaction.id)}" aria-label="Edit transaction">✎</button>
            </article>
          `).join("") : '<p class="finance-empty">No matching transactions.</p>'}
        </div>
      </section>
    `;
  }

  function renderBreakdownView(content) {
    const month = financeSummary.months.find((item) => item.key === selectedMonth) || financeSummary.current;
    const categories = expenseBreakdown(monthTransactions);
    const totalExpenses = categories.reduce((sum, category) => sum + category.total, 0);
    const branches = splitBranches(categories);

    syncBreakdownMonthNavigation(month);
    content.className = "finance-workspace-content finance-breakdown-view";
    content.innerHTML = `
      ${viewSwitcherMarkup("breakdown", true)}
      <div class="finance-breakdown-shell">
        <section class="finance-breakdown-hero">
          <div><small>Detailed expense map</small><h2>${escapeHtml(month.label)}</h2><p>Each major category expands into the subcategories that create its total.</p></div>
          <div class="finance-breakdown-total"><span>Total expenses</span><strong>${formatVnd(totalExpenses)}</strong><small>${monthTransactions.filter((transaction) => transaction.type === "expense").length} expense entries</small></div>
        </section>
        <section class="finance-map-card">
          <header class="finance-map-heading"><div><small>Money flow</small><h3>Expense mind map</h3></div><p>Select a category to focus its branch, then choose a subcategory to inspect individual entries.</p></header>
          <div class="finance-map-stage" id="finance-map-stage">
            ${categories.length ? `
              <div class="finance-map-side is-left">${branches.left.map((category, index) => renderMapBranch(category, "left", index, totalExpenses)).join("")}</div>
              <div class="finance-map-center"><small>${escapeHtml(month.shortLabel || month.label)}</small><strong>${formatVnd(totalExpenses)}</strong><span>Expenses</span></div>
              <div class="finance-map-side is-right">${branches.right.map((category, index) => renderMapBranch(category, "right", index, totalExpenses)).join("")}</div>
            ` : '<div class="finance-map-empty">No expenses have been entered for this month yet.</div>'}
          </div>
        </section>
        ${renderBreakdownInspectorMarkup()}
      </div>
    `;

    bindViewSwitcher(content);
    bindBreakdownInteractions(content);
  }

  function bindBreakdownInteractions(content) {
    const stage = content.querySelector("#finance-map-stage");
    content.querySelectorAll("[data-focus-map-category]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!stage) return;
        const category = button.dataset.focusMapCategory;
        stage.dataset.focusCategory = stage.dataset.focusCategory === category ? "" : category;
        if (!stage.dataset.focusCategory) stage.removeAttribute("data-focus-category");
      });
    });

    content.querySelectorAll("[data-breakdown-category]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedBreakdownLeaf = {
          category: button.dataset.breakdownCategory,
          subcategory: button.dataset.breakdownSubcategory || "",
        };
        content.querySelectorAll(".finance-map-leaf").forEach((leaf) => leaf.classList.toggle("is-selected", leaf === button));
        const inspector = content.querySelector("#finance-breakdown-inspector");
        inspector?.replaceWith(htmlToElement(renderBreakdownInspectorMarkup()));
        bindInspectorInteractions(content);
      });
    });

    bindInspectorInteractions(content);
  }

  function bindInspectorInteractions(content) {
    content.querySelector("[data-breakdown-add]")?.addEventListener("click", (event) => {
      openBreakdownEntry(event.currentTarget.dataset.breakdownAdd, event.currentTarget.dataset.breakdownAddSubcategory || "");
    });
    content.querySelectorAll("[data-breakdown-edit]").forEach((button) => {
      button.addEventListener("click", () => editFinanceTransaction(button.dataset.breakdownEdit));
    });
  }

  function openBreakdownEntry(category, subcategory) {
    openEntryForm("expense");
    const form = document.querySelector("#finance-entry-form");
    if (!form) return;
    if ([...form.elements.category.options].some((option) => option.value === category)) {
      form.elements.category.value = category;
      updateSubcategories(subcategory);
    }
  }

  function htmlToElement(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  }

  if (typeof financeErrorMessage === "function" && !financeErrorMessage.__joyBreakdownMessages) {
    const originalFinanceErrorMessage = financeErrorMessage;
    const breakdownFinanceErrorMessage = function financeBreakdownErrorMessage(code) {
      if (code === "FINANCE_SUBCATEGORY_REQUIRED") return "Choose a detail for this expense.";
      if (code === "FINANCE_SUBCATEGORY_INVALID") return "Choose a valid expense detail.";
      return originalFinanceErrorMessage(code);
    };
    breakdownFinanceErrorMessage.__joyBreakdownMessages = true;
    financeErrorMessage = breakdownFinanceErrorMessage;
  }

  installFinanceBreakdownStyles();

  renderMonthView = function renderFinanceMonthWithBreakdown(content) {
    if (!canShowBreakdown() && activeFinanceMonthView === "breakdown") activeFinanceMonthView = "overview";

    if (activeFinanceMonthView === "breakdown") {
      renderBreakdownView(content);
      return;
    }

    originalRenderMonthView(content);
    content.insertAdjacentHTML("afterbegin", viewSwitcherMarkup("overview", canShowBreakdown()));
    bindViewSwitcher(content);
  };
})();
