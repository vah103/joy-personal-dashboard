(() => {
  "use strict";

  const workspace = document.querySelector("#finance-workspace");
  if (!workspace) return;

  function arrangeP1008Overview(content) {
    const summary = content.querySelector(".p1008-summary");
    const servicesCard = content.querySelector(".p1008-services-card");
    if (!summary || !servicesCard) return;

    let overview = content.querySelector(".p1008-overview-grid");
    if (!overview) {
      overview = document.createElement("div");
      overview.className = "p1008-overview-grid";
      servicesCard.before(overview);
    }

    overview.append(summary, servicesCard);
  }

  function refineP1008Layout() {
    const content = workspace.querySelector("#finance-workspace-content");
    if (!content?.classList.contains("p1008-view")) return;

    arrangeP1008Overview(content);

    const peopleCard = content.querySelector(".p1008-people-table")?.closest(".p1008-card");
    if (!peopleCard) return;

    peopleCard.classList.add("p1008-people-card");
    const heading = peopleCard.querySelector("header h3");
    if (heading) heading.textContent = "Chia tiền dịch vụ";
    peopleCard.querySelector("header p")?.remove();
  }

  workspace.addEventListener("click", (event) => {
    if (event.target.closest("[data-finance-p1008]")) queueMicrotask(refineP1008Layout);
  });

  workspace.addEventListener("change", (event) => {
    if (event.target.matches("[data-p1008-month]")) queueMicrotask(refineP1008Layout);
  });

  workspace.addEventListener("focusout", (event) => {
    if (event.target.matches("[data-p1008-service]")) window.setTimeout(refineP1008Layout, 0);
  });

  queueMicrotask(refineP1008Layout);
})();
