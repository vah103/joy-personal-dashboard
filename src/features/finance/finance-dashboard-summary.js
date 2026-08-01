(() => {
  const panel = document.querySelector("#finance");
  if (!panel) return;

  const GOLD_HELD_TAEL = 0.05;

  function formatGoldHolding(value) {
    const amount = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
    return `${amount} tael`;
  }

  function setFullCardMoneyValue(element, amount) {
    if (!element) return;
    element.dataset.financeValue = formatVnd(amount);
    element.textContent = financeValuesHidden ? element.dataset.financeMask : element.dataset.financeValue;
  }

  function syncYearEndGoldHolding() {
    const yearEndValue = panel.querySelector('[data-finance-field="year-end"]');
    const yearEndContent = yearEndValue?.closest("span");
    const yearEndCard = yearEndValue?.closest(".finance-overview-stat");
    if (!yearEndContent || !yearEndCard) return;

    yearEndCard.classList.add("finance-year-end-card");
    yearEndContent.classList.add("finance-year-end-content");

    const description = yearEndContent.querySelector("em");
    if (description) description.textContent = "Projected cash balance";

    let goldAsset = yearEndContent.querySelector(".finance-year-end-gold");
    if (!goldAsset) {
      goldAsset = document.createElement("div");
      goldAsset.className = "finance-year-end-gold";
      goldAsset.setAttribute("aria-label", "Gold holding");

      const icon = document.createElement("span");
      icon.className = "finance-year-end-gold-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = `
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M7.2 6.7h9.6l3.1 4.4-2.2 6.2H6.3l-2.2-6.2 3.1-4.4Z" />
          <path d="M4.5 11.1h15M8.1 7l-1.8 4.1m9.6-4.1 1.8 4.1" />
        </svg>
      `;

      const value = document.createElement("b");
      value.dataset.financeMask = "•••";
      value.setAttribute("data-finance-value", "");

      goldAsset.append(icon, value);
      yearEndContent.append(goldAsset);
    }

    const value = goldAsset.querySelector("[data-finance-value]");
    if (!value) return;
    value.dataset.financeValue = formatGoldHolding(GOLD_HELD_TAEL);
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
