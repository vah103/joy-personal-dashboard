(() => {
  "use strict";

  const STORAGE_KEY = "joy.finance.p1008.shopping.v1";
  const PEOPLE = ["A Mạnh", "A Cường", "Vanh", "Dương", "Hưng", "Trung"];
  const workspace = document.querySelector("#finance-workspace");
  if (!workspace) return;

  let refineQueued = false;
  let refining = false;

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
    table.className = "p1008-shopping-people-table";
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

  function makeCardHeader(title, meta) {
    const header = document.createElement("header");
    const heading = document.createElement("h3");
    const label = document.createElement("span");
    heading.textContent = title;
    label.textContent = meta;
    header.append(heading, label);
    return header;
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
    if (!originalHeader || !body || !rule || !summary || !form) return;

    refining = true;
    try {
      const monthKey = currentMonthKey();
      const monthLabel = originalHeader.querySelector(".p1008-shopping-header-meta > span")?.textContent?.trim() || monthKey;
      const items = readMonthItems(monthKey);

      host.classList.remove("p1008-card");
      host.classList.add("p1008-shopping-two-table-section");
      originalHeader.classList.add("p1008-shopping-section-header");
      originalHeader.querySelector("header p")?.remove();

      const layout = document.createElement("div");
      layout.className = "p1008-shopping-table-layout";

      const itemsCard = document.createElement("section");
      itemsCard.className = "p1008-card p1008-shopping-items-card";
      itemsCard.append(makeCardHeader("Tiền mua đồ chung", "Nhập tay từng món"));

      const itemsBody = document.createElement("div");
      itemsBody.className = "p1008-shopping-items-body";
      itemsBody.append(form);
      if (tableWrap) itemsBody.append(tableWrap);
      else if (emptyState) itemsBody.append(emptyState);
      itemsCard.append(itemsBody);

      const peopleCard = document.createElement("section");
      peopleCard.className = "p1008-card p1008-shopping-people-card";
      peopleCard.append(makeCardHeader("Chia tiền mua đồ chung", monthLabel));

      const peopleWrap = document.createElement("div");
      peopleWrap.className = "p1008-table-wrap p1008-shopping-people-wrap";
      peopleWrap.append(buildPeopleTable(items));
      peopleCard.append(peopleWrap);

      layout.append(itemsCard, peopleCard);
      oldPeople?.remove();
      body.replaceChildren(rule, summary, layout);
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
    if (event.target.matches("[data-shopping-form]")) scheduleRefine();
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
