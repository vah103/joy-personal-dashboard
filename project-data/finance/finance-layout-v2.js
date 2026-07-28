(() => {
  if (typeof renderMonthView !== "function") return;

  const originalRenderYearView = typeof renderYearView === "function" ? renderYearView : null;

  function installSplitMonthStyles() {
    if (document.querySelector("#joy-finance-month-split-v5")) return;
    const style = document.createElement("style");
    style.id = "joy-finance-month-split-v5";
    style.textContent = `
      .finance-month-split-view{padding-top:14px}
      #finance-workspace.finance-month-layout-active .finance-tabs{display:flex;align-items:center;gap:8px}
      .finance-tab-month-nav{margin-left:auto;display:grid;grid-template-columns:34px minmax(112px,auto) 34px;align-items:center;gap:6px}
      #finance-workspace:not(.finance-month-layout-active) .finance-tab-month-nav{display:none}
      .finance-tab-month-nav button{width:34px;height:34px;padding:0;display:grid;place-items:center;border:1px solid rgba(63,72,74,.14);border-radius:11px;background:rgba(255,255,255,.72);color:#38515a;font:850 19px "Nunito",Arial,sans-serif;box-shadow:0 4px 12px rgba(54,64,66,.05)}
      .finance-tab-month-nav button:hover:not(:disabled){border-color:rgba(61,91,99,.3);background:#fff}
      .finance-tab-month-nav button:disabled{opacity:.32;cursor:default}
      .finance-tab-month-nav strong{min-width:112px;color:#344b52;font-size:12px;font-weight:900;text-align:center;white-space:nowrap}
      .finance-month-split{display:grid;grid-template-columns:minmax(0,2fr) minmax(270px,1fr);align-items:start;gap:16px}
      .finance-current-month{min-width:0}
      .finance-ledger-board-compact .finance-ledger-hero{min-height:132px;padding:17px 20px;display:grid;grid-template-columns:minmax(0,1fr) 238px;align-items:stretch;gap:12px;background:linear-gradient(135deg,#e9efeb 0%,#f5f2eb 100%)}
      .finance-ledger-board-compact .finance-ledger-hero>div:first-child{position:relative;isolation:isolate;overflow:hidden;width:auto;min-width:0;max-width:none;min-height:94px;padding:18px 24px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;text-align:left;border:1px solid rgba(61,81,86,.11);border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.92) 0%,rgba(238,245,240,.86) 100%);box-shadow:0 8px 22px rgba(48,62,66,.055)}
      .finance-ledger-board-compact .finance-ledger-hero>div:first-child::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:linear-gradient(180deg,#6f948b,#456b73);z-index:-1}
      .finance-ledger-board-compact .finance-ledger-hero>div:first-child::after{content:"";position:absolute;width:150px;height:150px;right:-46px;top:-70px;border-radius:50%;background:radial-gradient(circle,rgba(91,126,118,.15) 0%,rgba(91,126,118,0) 69%);z-index:-1}
      .finance-ledger-board-compact .finance-ledger-hero>div:first-child>small{margin:0 0 7px;color:#60777c;font-size:8.5px;line-height:1;letter-spacing:.14em}
      .finance-ledger-board-compact .finance-ledger-hero h2{margin:0;color:#2f444b;font-size:30px;line-height:1.06;font-weight:900}
      .finance-ledger-board-compact .finance-ledger-hero p{max-width:430px;margin:9px 0 0;color:#6f7f82;font-size:9.5px;line-height:1.4}
      .finance-ledger-board-compact .finance-ledger-balance{width:238px;min-width:238px;min-height:94px;padding:16px 18px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;border:0;border-radius:16px;background:linear-gradient(135deg,#466873,#607d78);box-shadow:0 10px 24px rgba(54,83,90,.16)}
      .finance-ledger-board-compact .finance-ledger-balance small{margin:0 0 8px;color:rgba(255,255,255,.72);font-size:8.5px;line-height:1;letter-spacing:.11em}
      .finance-ledger-board-compact .finance-ledger-balance strong{margin:0;color:#fff;font-size:25px;line-height:1.08}
      .finance-ledger-board-compact .finance-ledger-columns{padding:12px;gap:11px}
      .finance-ledger-board-compact .finance-ledger-column{border-radius:16px}
      .finance-ledger-board-compact .finance-ledger-column>header{min-height:64px;padding:12px 14px}
      .finance-ledger-board-compact .finance-ledger-column h3{font-size:15.5px}
      .finance-ledger-board-compact .finance-ledger-column>header>strong{font-size:16.5px}
      .finance-ledger-board-compact .finance-ledger-list{padding:6px}
      .finance-ledger-board-compact .finance-ledger-item-button{min-height:54px;padding:9px 10px;grid-template-columns:31px minmax(0,1fr) auto 16px;gap:9px}
      .finance-ledger-board-compact .finance-ledger-item-mark{width:30px;height:30px;border-radius:10px;font-size:15px}
      .finance-ledger-board-compact .finance-ledger-item-copy b{font-size:12.5px}
      .finance-ledger-board-compact .finance-ledger-item-copy small{margin-top:4px;font-size:9px}
      .finance-ledger-board-compact .finance-ledger-item-button>strong{font-size:11.5px}
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
      @media(max-width:700px){.finance-tabs{flex-wrap:wrap}.finance-tab-month-nav{width:100%;margin-left:0;grid-template-columns:34px 1fr 34px}.finance-ledger-board-compact .finance-ledger-hero{min-height:0;padding:14px;grid-template-columns:1fr;gap:10px}.finance-ledger-board-compact .finance-ledger-hero>div:first-child,.finance-ledger-board-compact .finance-ledger-balance{width:100%;min-width:0;min-height:88px}.finance-next-metrics{grid-template-columns:1fr}}
    `;
    document.head.append(style);
  }

  function nextMonthAfter(monthKey) {
    const months = Array.isArray(financeSummary?.months) ? financeSummary.months : [];
    const index = months.findIndex((month) => month.key === monthKey);
    return index >= 0 ? months[index + 1] || null : null;
  }

  function syncMonthTabNavigation(month) {
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
      <button type="button" data-tab-month-shift="-1" aria-label="Previous month" ${monthIndex <= 0 ? "disabled" : ""}>‹</button>
      <strong aria-live="polite">${escapeHtml(month.label)}</strong>
      <button type="button" data-tab-month-shift="1" aria-label="Next month" ${monthIndex < 0 || monthIndex >= months.length - 1 ? "disabled" : ""}>›</button>
    `;
    navigation.querySelectorAll("[data-tab-month-shift]").forEach((button) => {
      button.addEventListener("click", () => shiftMonth(Number(button.dataset.tabMonthShift)));
    });
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

  if (originalRenderYearView) {
    renderYearView = function renderYearWithoutMonthNavigation(content) {
      document.querySelector("#finance-workspace")?.classList.remove("finance-month-layout-active");
      originalRenderYearView(content);
    };
  }

  renderMonthView = function renderCompactMonthView(content) {
    const month = financeSummary.months.find((item) => item.key === selectedMonth) || financeSummary.current;
    const nextMonth = nextMonthAfter(month.key);
    const totals = transactionCategoryTotals(monthTransactions);
    const status = monthStatus(monthTransactions);
    const incomeTotal = Number(month.projected?.income || 0);
    const expenseTotal = Number(month.projected?.expenses || 0);
    const closing = Number(month.projected?.remaining || 0);

    syncMonthTabNavigation(month);
    content.className = "finance-workspace-content finance-month-split-view";
    content.innerHTML = `
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