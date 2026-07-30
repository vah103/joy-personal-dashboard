(() => {
  "use strict";

  const STORAGE_KEY = "joy.finance.p1008.shopping.v1";
  const PEOPLE = ["A Mạnh", "A Cường", "Vanh", "Dương", "Hưng", "Trung"];
  const workspace = document.querySelector("#finance-workspace");
  if (!workspace) return;

  let refineQueued = false;
  let refining = false;
  let addPanelOpen = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  function formatVnd(value) {
    return `${formatNumber(value)} ₫`;
  }

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

  function eligiblePeople(splitCount) {
    if (Number(splitCount) === 5) return PEOPLE.filter((person) => person !== "Hưng");
    if (Number(splitCount) === 4) return PEOPLE.filter((person) => person !== "Hưng" && person !== "A Mạnh");
    return [...PEOPLE];
  }

  function calculateMatrix(items) {
    const people = Object.fromEntries(PEOPLE.map((person) => [person, {
      items: Object.fromEntries(items.map((item) => [item.id, null])),
      total: 0,
    }]));

    for (const item of items) {
      const amount = Number(item.amount) || 0;
      const eligible = eligiblePeople(item.splitCount);
      const base = Math.floor(amount / eligible.length);
      let remainder = amount % eligible.length;

      eligible.forEach((person) => {
        const share = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        people[person].items[item.id] = share;
        people[person].total += share;
      });
    }

    return people;
  }

  function buildPeopleTable(items) {
    const people = calculateMatrix(items);
    const table = document.createElement("table");
    table.className = "p1008-people-table p1008-shopping-people-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Thành viên</th>
          ${items.map((item) => `<th>${escapeHtml(item.name)}</th>`).join("")}
          <th>Tổng đóng</th>
        </tr>
      </thead>
      <tbody>
        ${PEOPLE.map((person) => `
          <tr class="${person === "Vanh" ? "is-vanh" : ""}">
            <th><strong>${person}</strong>${person === "Vanh" ? "<small>Bạn</small>" : ""}</th>
            ${items.map((item) => {
              const value = people[person].items[item.id];
              return `<td>${value === null ? '<span class="p1008-not-applicable">—</span>' : formatVnd(value)}</td>`;
            }).join("")}
            <td><strong>${formatVnd(people[person].total)}</strong></td>
          </tr>
        `).join("")}
      </tbody>
    `;
    return table;
  }

  function buildEmptyItemsTable() {
    const wrap = document.createElement("div");
    wrap.className = "p1008-table-wrap p1008-shopping-table-wrap";
    wrap.innerHTML = `
      <table class="p1008-shopping-table p1008-services-table p1008-shopping-service-table">
        <thead><tr><th>Hạng mục</th><th>Tiền</th><th>Chia cho</th><th>Mỗi người</th></tr></thead>
        <tbody></tbody>
        <tfoot><tr><th>Tổng</th><td>0 ₫</td><td></td><td></td></tr></tfoot>
      </table>
    `;
    return wrap;
  }

  function makeCardHeader(title, trailing) {
    const header = document.createElement("header");
    const heading = document.createElement("h3");
    heading.textContent = title;
    header.append(heading);
    if (trailing) header.append(trailing);
    return header;
  }

  function prepareRule(rule) {
    rule.className = "p1008-rule-note is-standard p1008-shopping-rule-note";
    rule.innerHTML = `
      <strong>Quy tắc mua chung</strong>
      <span>Chia 6: đủ mọi người · Chia 5: không Hưng · Chia 4: không Hưng và A Mạnh. Khoản chốt ngày 15/8 được nhập trong Tháng 8/2026.</span>
    `;
  }

  function prepareItemsTable(tableWrap) {
    const table = tableWrap.querySelector("table");
    if (!table) return tableWrap;

    table.classList.add("p1008-services-table", "p1008-shopping-service-table");
    table.classList.remove("p1008-shopping-people-table");

    const headRow = table.tHead?.rows?.[0];
    if (headRow) {
      while (headRow.cells.length > 4) headRow.deleteCell(-1);
      while (headRow.cells.length < 4) headRow.append(document.createElement("th"));
      ["Hạng mục", "Tiền", "Chia cho", "Mỗi người"].forEach((label, index) => {
        headRow.cells[index].textContent = label;
      });
    }

    table.querySelectorAll("tbody tr").forEach((row) => {
      const deleteCell = row.cells[4];
      const deleteButton = deleteCell?.querySelector("[data-shopping-delete]") || null;
      deleteCell?.remove();

      let nameCell = row.cells[0];
      if (nameCell && nameCell.tagName !== "TH") {
        const replacement = document.createElement("th");
        while (nameCell.firstChild) replacement.append(nameCell.firstChild);
        nameCell.replaceWith(replacement);
        nameCell = replacement;
      }

      if (nameCell) {
        const nameInput = nameCell.querySelector("[data-shopping-name]");
        const control = document.createElement("div");
        control.className = "p1008-shopping-item-name-control";
        if (nameInput) control.append(nameInput);
        if (deleteButton) control.append(deleteButton);
        nameCell.replaceChildren(control);
      }

      row.cells[1]?.querySelector(".p1008-shopping-amount-field")?.classList.add("p1008-amount-field");
      row.cells[2]?.classList.add("p1008-shopping-share-select-cell");
      row.cells[3]?.classList.add("p1008-per-person");
    });

    const footRow = table.tFoot?.rows?.[0];
    if (footRow) {
      while (footRow.cells.length > 4) footRow.deleteCell(-1);
      while (footRow.cells.length < 4) footRow.append(document.createElement("td"));
      footRow.cells[0].textContent = "Tổng";
    }

    return tableWrap;
  }

  function makeItemsHeader(originalHeader, form) {
    const actions = document.createElement("div");
    actions.className = "p1008-shopping-card-header-actions";

    const syncBadge = originalHeader.querySelector(".p1008-shopping-sync");
    if (syncBadge) actions.append(syncBadge);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "p1008-shopping-add-toggle";
    toggle.setAttribute("aria-expanded", String(addPanelOpen));
    toggle.textContent = addPanelOpen ? "Đóng" : "+ Thêm món";
    toggle.addEventListener("click", () => {
      addPanelOpen = !addPanelOpen;
      form.hidden = !addPanelOpen;
      toggle.setAttribute("aria-expanded", String(addPanelOpen));
      toggle.textContent = addPanelOpen ? "Đóng" : "+ Thêm món";
      if (addPanelOpen) form.querySelector("[data-shopping-new-name]")?.focus();
    });
    actions.append(toggle);

    return makeCardHeader("Tiền mua đồ chung", actions);
  }

  function refineShoppingTables() {
    if (refining) return;
    const content = workspace.querySelector("#finance-workspace-content");
    if (!content?.classList.contains("p1008-view")) return;

    const host = content.querySelector(".p1008-shopping-card");
    if (!host || host.querySelector(":scope > .p1008-shopping-body > .p1008-shopping-table-layout")) return;

    const originalHeader = host.querySelector(":scope > header");
    const body = host.querySelector(":scope > .p1008-shopping-body");
    const rule = body?.querySelector(":scope > .p1008-shopping-rule");
    const summary = body?.querySelector(":scope > .p1008-shopping-summary");
    const form = body?.querySelector(":scope > .p1008-shopping-form");
    const tableWrap = body?.querySelector(":scope > .p1008-shopping-table-wrap");
    const emptyState = body?.querySelector(":scope > .p1008-shopping-empty");
    const oldPeople = body?.querySelector(":scope > .p1008-shopping-people");
    if (!originalHeader || !body || !rule || !form) return;

    refining = true;
    try {
      const monthKey = currentMonthKey();
      const monthLabel = originalHeader.querySelector(".p1008-shopping-header-meta > span")?.textContent?.trim() || monthKey;
      const items = readMonthItems(monthKey);

      prepareRule(rule);
      form.classList.add("p1008-shopping-add-panel");
      form.hidden = !addPanelOpen;

      const itemsCard = document.createElement("section");
      itemsCard.className = "p1008-card p1008-services-card p1008-shopping-items-card";
      itemsCard.append(makeItemsHeader(originalHeader, form));

      const itemsBody = document.createElement("div");
      itemsBody.className = "p1008-shopping-items-body";
      itemsBody.append(form);
      itemsBody.append(prepareItemsTable(tableWrap || buildEmptyItemsTable()));
      itemsCard.append(itemsBody);

      const peopleCard = document.createElement("section");
      peopleCard.className = "p1008-card p1008-people-card p1008-shopping-people-card";
      const month = document.createElement("span");
      month.textContent = monthLabel;
      peopleCard.append(makeCardHeader("Chia tiền mua đồ chung", month));

      const peopleWrap = document.createElement("div");
      peopleWrap.className = "p1008-table-wrap p1008-shopping-people-wrap";
      peopleWrap.append(buildPeopleTable(items));
      peopleCard.append(peopleWrap);

      const layout = document.createElement("div");
      layout.className = "p1008-shopping-table-layout";
      layout.append(itemsCard, peopleCard);

      summary?.remove();
      emptyState?.remove();
      oldPeople?.remove();
      body.replaceChildren(rule, layout);
      host.className = "p1008-shopping-card p1008-shopping-two-table-section";
      host.replaceChildren(body);
    } finally {
      refining = false;
    }
  }

  function scheduleRefine(delay = 0) {
    if (refineQueued) return;
    refineQueued = true;
    window.setTimeout(() => {
      refineQueued = false;
      refineShoppingTables();
    }, delay);
  }

  workspace.addEventListener("joy:p1008-rendered", () => scheduleRefine());
  document.addEventListener("joy:p1008-shopping-refresh", () => scheduleRefine());

  workspace.addEventListener("submit", (event) => {
    if (!event.target.matches("[data-shopping-form]")) return;
    addPanelOpen = false;
    scheduleRefine();
  });

  workspace.addEventListener("focusout", (event) => {
    if (event.target.matches("[data-shopping-name], [data-shopping-amount]")) scheduleRefine();
  });

  workspace.addEventListener("change", (event) => {
    if (event.target.matches("[data-shopping-split], [data-p1008-month]")) scheduleRefine();
  });

  workspace.addEventListener("click", (event) => {
    if (event.target.closest("[data-shopping-delete], [data-finance-p1008]")) scheduleRefine();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) scheduleRefine();
  });

  window.addEventListener("focus", () => {
    scheduleRefine(150);
    window.setTimeout(refineShoppingTables, 700);
  });

  const observer = new MutationObserver(() => scheduleRefine());
  observer.observe(workspace, { childList: true, subtree: true });

  queueMicrotask(refineShoppingTables);
})();