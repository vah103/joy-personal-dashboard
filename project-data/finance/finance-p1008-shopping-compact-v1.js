(() => {
  "use strict";

  const STORAGE_KEY = "joy.finance.p1008.shopping.v1";
  const workspace = document.querySelector("#finance-workspace");
  if (!workspace) return;

  let queued = false;

  function currentMonthKey() {
    return document.querySelector("[data-p1008-month]")?.value || "2026-08";
  }

  function readMonthItems(monthKey) {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return Array.isArray(data?.[monthKey]) ? data[monthKey] : [];
    } catch {
      return [];
    }
  }

  function simplifySplitControls(root) {
    root.querySelectorAll("[data-shopping-split], [data-shopping-new-split]").forEach((select) => {
      Array.from(select.options).forEach((option) => {
        if (option.textContent !== option.value) option.textContent = option.value;
      });
    });
    root.querySelectorAll(".p1008-shopping-split-cell small").forEach((note) => note.remove());
  }

  function sortedItems(items) {
    return items
      .map((item, index) => ({ item, index, splitCount: Number(item?.splitCount) || 0 }))
      .sort((left, right) => right.splitCount - left.splitCount || left.index - right.index)
      .map(({ item }) => item);
  }

  function sortItemRows(root) {
    const body = root.querySelector(".p1008-shopping-service-table tbody");
    if (!body) return;

    const rows = Array.from(body.rows);
    const sorted = rows
      .map((row, index) => ({
        row,
        index,
        splitCount: Number(row.querySelector("[data-shopping-split]")?.value) || 0,
      }))
      .sort((left, right) => right.splitCount - left.splitCount || left.index - right.index)
      .map(({ row }) => row);

    if (rows.some((row, index) => row !== sorted[index])) sorted.forEach((row) => body.append(row));
  }

  function sortPeopleColumns(root) {
    const items = readMonthItems(currentMonthKey());
    if (items.length < 2) return;

    const desired = sortedItems(items);
    const currentIds = items.map((item) => String(item?.id || ""));
    const desiredIds = desired.map((item) => String(item?.id || ""));
    if (currentIds.every((id, index) => id === desiredIds[index])) return;

    const indexes = desiredIds.map((id) => currentIds.indexOf(id));
    if (indexes.some((index) => index < 0)) return;

    const table = root.querySelector(".p1008-shopping-people-table");
    if (!table) return;

    const orderKey = desiredIds.join("|");
    if (table.dataset.shoppingItemOrder === orderKey) return;

    const reorder = (row) => {
      const cells = Array.from(row.children);
      if (cells.length !== items.length + 2) return;
      const first = cells[0];
      const last = cells[cells.length - 1];
      const itemCells = cells.slice(1, -1);
      row.replaceChildren(first, ...indexes.map((index) => itemCells[index]), last);
    };

    if (table.tHead?.rows?.[0]) reorder(table.tHead.rows[0]);
    Array.from(table.tBodies?.[0]?.rows || []).forEach(reorder);
    table.dataset.shoppingItemOrder = orderKey;
  }

  function removeSyncLabels(root) {
    root.querySelectorAll(".p1008-local-state").forEach((badge) => badge.remove());
  }

  function polish() {
    const content = workspace.querySelector("#finance-workspace-content.p1008-view");
    if (!content) return;

    removeSyncLabels(content);
    simplifySplitControls(content);
    sortItemRows(content);
    sortPeopleColumns(content);
  }

  function schedulePolish() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      polish();
    });
  }

  workspace.addEventListener("joy:p1008-rendered", schedulePolish);
  workspace.addEventListener("change", (event) => {
    if (event.target.matches("[data-shopping-split], [data-p1008-month]")) schedulePolish();
  });
  workspace.addEventListener("submit", (event) => {
    if (event.target.matches("[data-shopping-form]")) schedulePolish();
  });
  document.addEventListener("joy:p1008-shopping-refresh", schedulePolish);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) schedulePolish();
  });

  const observer = new MutationObserver(schedulePolish);
  observer.observe(workspace, { childList: true, subtree: true });
  queueMicrotask(polish);
})();
