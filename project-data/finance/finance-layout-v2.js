(() => {
  if (typeof renderMonthView !== "function") return;

  function nextMonthAfter(monthKey) {
    const months = Array.isArray(financeSummary?.months) ? financeSummary.months : [];
    const index = months.findIndex((month) => month.key === monthKey);
    return index >= 0 ? months[index + 1] || null : null;
  }

  function renderNextMonthSummary(month) {
    if (!month) {
      return `
        <aside class="finance-next-month" aria-label="End of year summary">
          <div class="finance-next-month-heading">
            <div><small>Next step</small><h3>Year complete</h3></div>
          </div>
          <div class="finance-next-closing">
            <span>Projected year-end</span>
            <strong>${formatVnd(financeSummary?.annual?.projectedYearEnd || 0)}</strong>
          </div>
          <p class="finance-next-note">December is the final month in this Finance plan.</p>
          <button class="finance-next-open" type="button" data-finance-tab="year">Open year view</button>
        </aside>
      `;
    }

    const projected = month.projected || {};
    const statusLabel = month.status === "in-progress" ? "In progress" : capitalize(month.status || "planned");
    return `
      <aside class="finance-next-month" aria-label="${escapeHtml(month.label)} summary">
        <div class="finance-next-month-heading">
          <div><small>Next month</small><h3>${escapeHtml(month.label)}</h3></div>
          <span class="finance-status ${month.status || "planned"}">${escapeHtml(statusLabel)}</span>
        </div>

        <div class="finance-next-closing">
          <span>Projected closing balance</span>
          <strong>${formatVnd(projected.remaining || 0)}</strong>
          <small>${Number(month.transactionCount || 0)} planned ${Number(month.transactionCount || 0) === 1 ? "entry" : "entries"}</small>
        </div>

        <div class="finance-next-metrics">
          <div><span>Carryover</span><strong>${formatVnd(projected.carryover || 0)}</strong></div>
          <div><span>Income</span><strong>${formatVnd(projected.income || 0)}</strong></div>
          <div><span>Expenses</span><strong>${formatVnd(projected.expenses || 0)}</strong></div>
        </div>

        <p class="finance-next-note">A compact preview of money already known for the following month.</p>
        <button class="finance-next-open" type="button" data-open-next-month="${month.key}">Open ${escapeHtml(month.shortLabel || month.label)}</button>
      </aside>
    `;
  }

  renderMonthView = function renderCompactMonthView(content) {
    const month = financeSummary.months.find((item) => item.key === selectedMonth) || financeSummary.current;
    const nextMonth = nextMonthAfter(month.key);
    const totals = transactionCategoryTotals(monthTransactions);
    const status = monthStatus(monthTransactions);
    const incomeTotal = Number(month.projected?.income || 0);
    const expenseTotal = Number(month.projected?.expenses || 0);
    const closing = Number(month.projected?.remaining || 0);

    content.className = "finance-workspace-content finance-month-split-view";
    content.innerHTML = `
      <div class="finance-month-toolbar finance-ledger-month-toolbar">
        <button type="button" data-month-shift="-1" aria-label="Previous month">‹</button>
        <div><small>Monthly detail</small><strong>${escapeHtml(month.label)}</strong></div>
        <button type="button" data-month-shift="1" aria-label="Next month">›</button>
      </div>

      <div class="finance-month-split">
        <main class="finance-current-month">
          <section class="finance-ledger-board finance-ledger-board-compact" aria-label="${escapeHtml(month.label)} finance overview">
            <header class="finance-ledger-hero">
              <div>
                <small>Current month</small>
                <h2>${escapeHtml(month.label)}</h2>
                <p>${escapeHtml(status)} · Carryover is included in Income.</p>
              </div>
              <div class="finance-ledger-balance">
                <small>Closing balance</small>
                <strong>${formatVnd(closing)}</strong>
              </div>
            </header>

            <div class="finance-ledger-summary finance-ledger-summary-two">
              <div><span>Income</span><strong>${formatVnd(incomeTotal)}</strong><small>Includes Carryover</small></div>
              <div><span>Expenses</span><strong>${formatVnd(expenseTotal)}</strong><small>Actual + planned</small></div>
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
        </main>

        ${renderNextMonthSummary(nextMonth)}
      </div>
    `;

    content.querySelectorAll("[data-month-shift]").forEach((button) => button.addEventListener("click", () => shiftMonth(Number(button.dataset.monthShift))));
    content.querySelectorAll("[data-finance-add]").forEach((button) => button.addEventListener("click", () => openEntryForm(button.dataset.financeAdd)));
    content.querySelectorAll("[data-finance-edit]").forEach((button) => button.addEventListener("click", () => editFinanceTransaction(button.dataset.financeEdit)));
    content.querySelectorAll("[data-finance-delete]").forEach((button) => button.addEventListener("click", () => removeFinanceTransaction(button.dataset.financeDelete)));
    content.querySelector("[data-open-next-month]")?.addEventListener("click", async (event) => {
      selectedMonth = event.currentTarget.dataset.openNextMonth;
      await loadFinanceSummary();
    });
    content.querySelector('.finance-next-month [data-finance-tab="year"]')?.addEventListener("click", () => switchWorkspaceView("year"));
    bindInlineCategoryForms(content);
  };
})();
