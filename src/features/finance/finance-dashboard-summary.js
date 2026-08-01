(() => {
  const panel = document.querySelector("#finance");
  if (!panel) return;

  function syncProjectedFinanceSummary() {
    if (typeof financeSummary === "undefined") return;

    const projected = financeSummary?.current?.projected;
    if (!projected) return;

    const values = {
      remaining: projected.remaining,
      income: projected.income,
      expenses: projected.expenses,
    };

    Object.entries(values).forEach(([field, value]) => {
      setMoneyValue(panel.querySelector(`[data-finance-field="${field}"]`), value);
    });

    const balanceLabel = panel.querySelector(".finance-available > small b");
    if (balanceLabel) balanceLabel.textContent = "Closing balance";

    const expenseNote = panel.querySelector('.finance-overview-stat [data-finance-field="expenses"]')?.closest("span")?.querySelector("em");
    if (expenseNote) expenseNote.textContent = "Actual + planned";

    const source = panel.querySelector("#finance-source");
    if (source) source.textContent = "Joy is the source of truth · Monthly card includes actual + planned";

    setFinancePrivacy(financeValuesHidden);
  }

  document.addEventListener("joy:finance-dashboard-rendered", syncProjectedFinanceSummary);
  syncProjectedFinanceSummary();
})();
