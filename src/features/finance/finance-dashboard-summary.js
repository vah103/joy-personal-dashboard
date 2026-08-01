(() => {
  const panel = document.querySelector("#finance");
  if (!panel) return;

  const GOLD_HELD_TAEL = 0.05;
  const GOLD_COIN_IMAGE = "data:image/webp;base64,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";

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

      const image = document.createElement("img");
      image.src = GOLD_COIN_IMAGE;
      image.alt = "";
      image.decoding = "async";
      image.draggable = false;
      icon.append(image);

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
