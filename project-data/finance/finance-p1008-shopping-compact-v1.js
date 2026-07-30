(() => {
  "use strict";

  const STORAGE_KEY = "joy.finance.p1008.shopping.v1";
  const workspace = document.querySelector("#finance-workspace");
  if (!workspace) return;

  let queued = false;
  let activeCaptureCard = null;

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

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function configureCaptureGrid(card) {
    const table = card.querySelector(".p1008-shopping-people-table");
    const columnCount = Math.max(2, table?.tHead?.rows?.[0]?.cells?.length || 2);
    const itemCount = Math.max(0, columnCount - 2);
    const middleColumns = itemCount ? `repeat(${itemCount}, minmax(0, 1fr))` : "";
    const gridColumns = ["minmax(0, 1.1fr)", middleColumns, "minmax(0, 1.15fr)"].filter(Boolean).join(" ");
    const minimumCanvasWidth = columnCount > 7 ? columnCount * 96 : 0;

    card.style.setProperty("--p1008-shopping-capture-columns", gridColumns);
    card.style.setProperty("--p1008-shopping-capture-min-width", `${minimumCanvasWidth}px`);
    card.dataset.shoppingCaptureColumns = String(columnCount);
  }

  function updateCaptureButton(card, active) {
    const button = card.querySelector("[data-shopping-fullscreen]");
    if (!button) return;
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Thoát toàn màn hình bảng mua đồ chung" : "Xem toàn màn hình bảng mua đồ chung");
    const label = button.querySelector(".p1008-fullscreen-label");
    if (label) label.textContent = active ? "Thoát" : "Toàn màn hình";
  }

  function setCaptureState(card, active) {
    if (active) configureCaptureGrid(card);
    card.classList.toggle("is-shopping-capture-mode", active);
    document.body.classList.toggle("p1008-shopping-capture-active", active);
    updateCaptureButton(card, active);
    activeCaptureCard = active ? card : null;
  }

  async function lockLandscape() {
    const orientation = globalThis.screen?.orientation;
    if (typeof orientation?.lock !== "function") return;
    try {
      await orientation.lock("landscape");
    } catch {
      // iOS Safari and some embedded browsers require manual rotation.
    }
  }

  function unlockOrientation() {
    const orientation = globalThis.screen?.orientation;
    if (typeof orientation?.unlock !== "function") return;
    try {
      orientation.unlock();
    } catch {
      // Orientation unlock is best-effort.
    }
  }

  async function enterCapture(card) {
    if (activeCaptureCard && activeCaptureCard !== card) setCaptureState(activeCaptureCard, false);
    configureCaptureGrid(card);
    setCaptureState(card, true);

    const request = card.requestFullscreen || card.webkitRequestFullscreen;
    if (typeof request === "function") {
      try {
        await request.call(card);
        card.dataset.shoppingNativeFullscreen = "true";
      } catch {
        delete card.dataset.shoppingNativeFullscreen;
      }
    }
    await lockLandscape();
  }

  async function exitCapture(card) {
    const current = fullscreenElement();
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (current === card && typeof exit === "function") {
      try {
        await exit.call(document);
      } catch {
        // The fixed-position fallback can still be closed below.
      }
    }
    delete card.dataset.shoppingNativeFullscreen;
    setCaptureState(card, false);
    unlockOrientation();
  }

  function installShoppingFullscreen(root) {
    root.querySelectorAll(".p1008-shopping-people-card").forEach((card) => {
      configureCaptureGrid(card);
      const header = card.querySelector(":scope > header");
      if (!header || header.querySelector("[data-shopping-fullscreen]")) return;

      let actions = header.querySelector(".p1008-shopping-fullscreen-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "p1008-shopping-fullscreen-actions";
        Array.from(header.children)
          .filter((child) => child.tagName !== "H3" && child !== actions)
          .forEach((child) => actions.append(child));
        header.append(actions);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "p1008-fullscreen-button p1008-shopping-fullscreen-button";
      button.dataset.shoppingFullscreen = "true";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Xem toàn màn hình bảng mua đồ chung");
      button.innerHTML = '<span class="p1008-fullscreen-icon" aria-hidden="true">⛶</span><span class="p1008-fullscreen-label">Toàn màn hình</span>';
      button.addEventListener("click", () => {
        if (card.classList.contains("is-shopping-capture-mode")) void exitCapture(card);
        else void enterCapture(card);
      });
      actions.append(button);
    });
  }

  function polish() {
    const content = workspace.querySelector("#finance-workspace-content.p1008-view");
    if (!content) return;

    if (activeCaptureCard && !activeCaptureCard.isConnected) {
      document.body.classList.remove("p1008-shopping-capture-active");
      activeCaptureCard = null;
      unlockOrientation();
    }

    removeSyncLabels(content);
    simplifySplitControls(content);
    sortItemRows(content);
    sortPeopleColumns(content);
    installShoppingFullscreen(content);
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

  const handleFullscreenChange = () => {
    if (!activeCaptureCard) return;
    if (fullscreenElement() === activeCaptureCard) return;
    delete activeCaptureCard.dataset.shoppingNativeFullscreen;
    setCaptureState(activeCaptureCard, false);
    unlockOrientation();
  };
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeCaptureCard && fullscreenElement() !== activeCaptureCard) {
      void exitCapture(activeCaptureCard);
    }
  });

  const observer = new MutationObserver(schedulePolish);
  observer.observe(workspace, { childList: true, subtree: true });
  queueMicrotask(polish);
})();
