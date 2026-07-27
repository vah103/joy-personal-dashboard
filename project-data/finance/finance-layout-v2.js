(() => {
  const CATEGORY_ORDER = [
    "House",
    "Meals",
    "Transportation",
    "Clothing",
    "Dating",
    "Hanging out",
    "Haircare",
    "Money leaks",
    "Other",
  ];

  let transformQueued = false;

  function openExistingControl(selector) {
    const control = document.querySelector(selector);
    if (control) control.click();
  }

  function replaceDashboardRanking() {
    const card = document.querySelector(".finance-category-card");
    if (!card || card.dataset.financeLayoutV2 === "true") return;

    card.dataset.financeLayoutV2 = "true";
    card.classList.add("finance-month-actions-card");
    card.innerHTML = `
      <span class="finance-pulse-heading">
        <strong>Monthly finance</strong>
        <small>Quick actions</small>
      </span>
      <div class="finance-month-action-grid">
        <button class="is-primary" type="button" data-finance-v2-action="month">
          <span>Open month</span>
          <small>View the full table</small>
        </button>
        <button type="button" data-finance-v2-action="expense">
          <span>+ Expense</span>
          <small>Record money out</small>
        </button>
        <button type="button" data-finance-v2-action="income">
          <span>+ Income</span>
          <small>Record money in</small>
        </button>
      </div>
    `;

    card.querySelector('[data-finance-v2-action="month"]')?.addEventListener("click", () => {
      openExistingControl("[data-finance-open]");
    });
    card.querySelector('[data-finance-v2-action="expense"]')?.addEventListener("click", () => {
      openExistingControl('[data-finance-add="expense"]');
    });
    card.querySelector('[data-finance-v2-action="income"]')?.addEventListener("click", () => {
      const workspace = document.querySelector("#finance-workspace");
      if (workspace?.hidden) openExistingControl("[data-finance-open]");
      window.setTimeout(() => openExistingControl('#finance-workspace [data-finance-add="income"]'), 0);
    });
  }

  function revealWorkspaceAmounts() {
    const content = document.querySelector("#finance-workspace-content");
    if (!content) return;

    content.classList.remove("finance-values-hidden");
    content.querySelectorAll("[data-finance-value]").forEach((element) => {
      const value = element.dataset.financeValue;
      if (value && element.textContent !== value) element.textContent = value;
    });
  }

  function arrangeCategoryCells() {
    const list = document.querySelector("#finance-workspace-content .finance-breakdown-list");
    if (!list) return;

    list.classList.add("finance-category-table");
    const rows = [...list.children];
    rows.sort((left, right) => {
      const leftLabel = left.querySelector("b")?.textContent.trim() || "";
      const rightLabel = right.querySelector("b")?.textContent.trim() || "";
      const leftIndex = CATEGORY_ORDER.indexOf(leftLabel);
      const rightIndex = CATEGORY_ORDER.indexOf(rightLabel);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    });
    rows.forEach((row) => list.append(row));
  }

  function transformWorkspace() {
    const content = document.querySelector("#finance-workspace-content");
    if (!content) return;

    revealWorkspaceAmounts();

    const monthCards = content.querySelector(".finance-detail-cards:not(.finance-annual-cards)");
    monthCards?.classList.add("finance-bento-summary");

    const annualCards = content.querySelector(".finance-annual-cards");
    annualCards?.classList.add("finance-bento-annual");

    const breakdownTitle = content.querySelector(".finance-breakdown h3");
    if (breakdownTitle) breakdownTitle.textContent = "Expenses by category";

    arrangeCategoryCells();
  }

  function runTransforms() {
    transformQueued = false;
    replaceDashboardRanking();
    transformWorkspace();
  }

  function queueTransforms() {
    if (transformQueued) return;
    transformQueued = true;
    queueMicrotask(runTransforms);
  }

  const observer = new MutationObserver(queueTransforms);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  queueTransforms();
})();
