(() => {
  if (typeof renderMonthView !== "function") return;

  function installSplitMonthStyles() {
    if (document.querySelector("#joy-finance-month-split-v1")) return;
    const style = document.createElement("style");
    style.id = "joy-finance-month-split-v1";
    style.textContent = `
      .finance-month-split-view{padding-top:18px}
      .finance-month-split{display:grid;grid-template-columns:minmax(0,2fr) minmax(270px,1fr);align-items:start;gap:16px}
      .finance-current-month{min-width:0}
      .finance-ledger-board-compact .finance-ledger-hero{min-height:112px;padding:18px 20px;gap:18px}
      .finance-ledger-board-compact .finance-ledger-hero h2{margin:4px 0;font-size:27px}
      .finance-ledger-board-compact .finance-ledger-hero p{font-size:10px}
      .finance-ledger-board-compact .finance-ledger-balance{min-width:190px;padding:14px 16px;border-radius:15px}
      .finance-ledger-board-compact .finance-ledger-balance strong{font-size:23px}
      .finance-ledger-summary-two{grid-template-columns:repeat(2,minmax(0,1fr))}
      .finance-ledger-summary-two>div{padding:13px 16px}
      .finance-ledger-summary-two strong{font-size:17px}
      .finance-ledger-board-compact .finance-ledger-columns{padding:12px;gap:11px}
      .finance-ledger-board-compact .finance-ledger-column{border-radius:16px}
      .finance-ledger-board-compact .finance-ledger-column>header{min-height:62px;padding:12px 14px}
      .finance-ledger-board-compact .finance-ledger-column h3{font-size:14px}
      .finance-ledger-board-compact .finance-ledger-column>header>strong{font-size:15px}
      .finance-ledger-board-compact .finance-ledger-list{padding:6px}
      .finance-ledger-board-compact .finance-ledger-item-button{min-height:50px;padding:8px 9px;grid-template-columns:29px minmax(0,1fr) auto 15px;gap:8px}
      .finance-ledger-board-compact .finance-ledger-item-mark{width:28px;height:28px;border-radius:9px;font-size:14px}
      .finance-ledger-board-compact .finance-ledger-item-copy b{font-size:10.5px}
      .finance-ledger-board-compact .finance-ledger-item-copy small{font-size:7.5px}
      .finance-ledger-board-compact .finance-ledger-item-button>strong{font-size:10px}
      .finance-ledger-board-compact .finance-ledger-composer{padding:0 10px 11px}
      .finance-ledger-board-compact .finance-ledger-input-row{grid-template-columns:1fr;gap:7px}
      .finance-ledger-board-compact .finance-ledger-add-button{width:100%}
      .finance-current-month .finance-ledger-transactions{margin-top:14px}
      .finance-next-month{position:sticky;top:0;overflow:hidden;border:1px solid rgba(61,76,80,.12);border-radius:22px;background:linear-gradient(155deg,#f9faf7,#edf2ef);box-shadow:0 16px 38px rgba(45,58,61,.09)}
      .finance-next-month-heading{padding:18px 18px 14px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(61,76,80,.09)}
      .finance-next-month-heading small{display:block;color:#728084;font-size:9px;font-weight:850;letter-spacing:.09em;text-transform:uppercase}
      .finance-next-month-heading h3{margin:4px 0 0;color:#30484f;font-size:21px;font-weight:900}
      .finance-next-closing{padding:22px 18px;background:linear-gradient(135deg,#476b75,#667f7a);color:#fff}
      .finance-next-closing span,.finance-next-closing strong,.finance-next-closing small{display:block}
      .finance-next-closing span{font-size:9px;font-weight:750;opacity:.78}
      .finance-next-closing strong{margin-top:7px;font-size:28px;font-weight:900;line-height:1.05}
      .finance-next-closing small{margin-top:8px;font-size:8px;font-weight:650;opacity:.7}
      .finance-next-metrics{display:grid;padding:8px 14px}
      .finance-next-metrics>div{padding:12px 4px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(61,76,80,.08)}
      .finance-next-metrics>div:last-child{border-bottom:0}
      .finance-next-metrics span{color:#718084;font-size:10px;font-weight:700}
      .finance-next-metrics strong{color:#36525a;font-size:12px;font-weight:900;white-space:nowrap}
      .finance-next-note{margin:0;padding:12px 18px 4px;color:#7f898b;font-size:9px;font-weight:650;line-height:1.5}
      .finance-next-open{width:calc(100% - 36px);min-height:40px;margin:14px 18px 18px;border:0;border-radius:12px;background:#426772;color:#fff;font:800 11px "Nunito",Arial,sans-serif;cursor:pointer}
      .finance-next-open:hover{background:#365b66}
      @media(max-width:980px){.finance-month-split{grid-template-columns:1fr}.finance-next-month{position:static}.finance-next-metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px}.finance-next-metrics>div{padding:10px;display:block;border:1px solid rgba(61,76,80,.08);border-radius:12px}.finance-next-metrics strong{display:block;margin-top:5px}}
      @media(max-width:700px){.finance-ledger-board-compact .finance-ledger-hero{align-items:flex-start;flex-direction:column}.finance-ledger-board-compact .finance-ledger-balance{width:100%;min-width:0}.finance-next-metrics{grid-template-columns:1fr}.finance-ledger-summary-two{grid-template-columns:1fr}.finance-ledger-summary-two>div{border-right:0;border-bottom:1px solid rgba(62,72,74,.08)}}
    `;
    document.head.append(style);
  }

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

  installSplitMonthStyles();

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
