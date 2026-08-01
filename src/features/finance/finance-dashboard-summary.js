(() => {
  const panel = document.querySelector("#finance");
  if (!panel) return;

  const GOLD_HELD_CHI = 0.5;

  function formatGoldHolding(value) {
    const amount = new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 1,
    }).format(Number(value || 0));
    return `${amount} chỉ`;
  }

  function setFullCardMoneyValue(element, amount) {
    if (!element) return;
    element.dataset.financeValue = formatVnd(amount);
    element.textContent = financeValuesHidden ? element.dataset.financeMask : element.dataset.financeValue;
  }

  function syncYearEndGoldHolding() {
    const yearEndValue = panel.querySelector('[data-finance-field="year-end"]');
    const yearEndContent = yearEndValue?.closest("span");
    if (!yearEndContent) return;

    let goldRow = yearEndContent.querySelector(".finance-year-end-gold");
    if (!goldRow) {
      goldRow = document.createElement("div");
      goldRow.className = "finance-year-end-gold";

      const label = document.createElement("span");
      label.textContent = "Gold held";

      const value = document.createElement("b");
      value.dataset.financeMask = "•••";
      value.setAttribute("data-finance-value", "");

      goldRow.append(label, value);
      yearEndContent.append(goldRow);
    }

    const value = goldRow.querySelector("[data-finance-value]");
    if (!value) return;
    value.dataset.financeValue = formatGoldHolding(GOLD_HELD_CHI);
    value.textContent = financeValuesHidden ? value.dataset.financeMask : value.dataset.financeValue;
  }

  function syncProjectedFinanceSummary() {
    if (typeof financeSummary === "undefined") return;

    const projected = financeSummary?.current?.projected;
    if (!projected) return;

    const values = {
      remaining: projected.remaining,
      income: projected.income,
      expenses: projected.expenses,
      "year-end": financeSummary?.annual?.projectedYearEnd,
    };

    panel.classList.add("finance-full-money-values");
    Object.entries(values).forEach(([field, value]) => {
      setFullCardMoneyValue(panel.querySelector(`[data-finance-field="${field}"]`), value);
    });

    const balanceLabel = panel.querySelector(".finance-available > small b");
    if (balanceLabel) balanceLabel.textContent = "Closing balance";

    const expenseNote = panel.querySelector('.finance-overview-stat [data-finance-field="expenses"]')?.closest("span")?.querySelector("em");
    if (expenseNote) expenseNote.textContent = "Actual + planned";

    const source = panel.querySelector("#finance-source");
    if (source) source.textContent = "Joy is the source of truth · Monthly card includes actual + planned";

    syncYearEndGoldHolding();
    setFinancePrivacy(financeValuesHidden);
  }

  document.addEventListener("joy:finance-dashboard-rendered", syncProjectedFinanceSummary);
  syncProjectedFinanceSummary();
})();
