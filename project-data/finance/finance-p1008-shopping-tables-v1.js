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

  function ensureSummaryStyle() {
    if (document.querySelector("#p1008-shopping-summary-match-style")) return;
    const style = document.createElement("style");
    style.id = "p1008-shopping-summary-match-style";
    style.textContent = `
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style article {
        min-width: 0;
        padding: 18px 20px;
        border: 1px solid rgba(58, 77, 82, .11);
        border-radius: 17px;
        background: rgba(255, 255, 255, .52);
      }
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style article.is-primary {
        background: linear-gradient(135deg, #426873, #607e79);
        box-shadow: 0 10px 24px rgba(54, 83, 90, .14);
      }
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style span,
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style strong,
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style small {
        display: block;
      }
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style span {
        color: #738286;
        font-size: 11px;
        font-weight: 800;
      }
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style strong {
        margin-top: 8px;
        color: #304a51;
        font: 700 29px/1.08 "OpenAI Sans", "Instrument Sans", "Segoe UI", sans-serif;
      }
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style small {
        margin-top: 7px;
        overflow: hidden;
        color: #849093;
        font-size: 9px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style .is-primary span,
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style .is-primary small {
        color: rgba(255, 255, 255, .76);
      }
      .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style .is-primary strong {
        color: #fff;
      }
      @media (max-width: 560px) {
        .p1008-shopping-two-table-section .p1008-shopping-summary.is-service-style {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.append(style);
  }

  function updateShoppingSummary(summary, items) {
    const people = calculateMatrix(items);
    const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    summary.classList.add("is-service-style");
    summary.setAttribute("aria-label", "Tóm tắt tiền mua đồ chung");
    summary.innerHTML = `
      <article>
        <span>Tổng mua chung</span>
        <strong>${formatVnd(total)}</strong>
        <small>${items.length} món trong tháng</small>
      </article>
      <article class="is-primary">
        <span>Phần của Vanh</span>
        <strong>${formatVnd(people.Vanh.total)}</strong>
        <small>Tự tính theo bảng chia</small>
      </article>
      <article>
        <span>Thành viên</span>
        <strong>6 người</strong>
        <small>A Mạnh · A Cường · Vanh · Dương · Hưng · Trung</small>
      </article>
    `;
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

  function buildEmptyItemsTable() {
    const wrap = document.createElement("div");
    wrap.className = "p1008-table-wrap p1008-shopping-table-wrap";
    wrap.innerHTML = `
      <table class="p1008-shopping-table">
        <thead><tr><th>Món mua</th><th>Tiền</th><th>Chia cho</th><th>Mỗi người</th><th></th></tr></thead>
        <tbody></tbody>
        <tfoot><tr><th>Tổng</th><td>0 ₫</td><td></td><td></td><td></td></tr></tfoot>
      </table>
    `;
    return wrap;
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

      ensureSummaryStyle();
      updateShoppingSummary(summary, items);

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
      itemsBody.append(tableWrap || buildEmptyItemsTable());
      emptyState?.remove();
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
