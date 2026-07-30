(() => {
  "use strict";

  const workspace = document.querySelector("#finance-workspace");
  if (!workspace) return;

  let captureCard = null;
  let capturePlaceholder = null;
  let captureScrollY = 0;
  let nativeFullscreenRequested = false;

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

  function setCaptureButtonState(button, active) {
    if (!button) return;
    button.setAttribute("aria-pressed", String(active));
    button.title = active ? "Thoát chế độ toàn màn hình" : "Xem toàn màn hình để chụp bảng";
    const label = button.querySelector(".p1008-fullscreen-label");
    if (label) label.textContent = active ? "Thoát" : "Toàn màn hình";
  }

  function exitCaptureMode({ skipFullscreenExit = false } = {}) {
    const card = captureCard;
    if (!card) return;

    const button = card.querySelector("[data-p1008-fullscreen]");
    setCaptureButtonState(button, false);
    card.classList.remove("is-capture-mode");
    document.body.classList.remove("p1008-capture-active");

    const placeholder = capturePlaceholder;
    captureCard = null;
    capturePlaceholder = null;
    nativeFullscreenRequested = false;

    if (placeholder?.isConnected) {
      placeholder.replaceWith(card);
    } else {
      workspace.querySelector("#finance-workspace-content")?.append(card);
    }

    if (!skipFullscreenExit && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    window.scrollTo({ top: captureScrollY, behavior: "auto" });
  }

  function enterCaptureMode(card, button) {
    if (captureCard === card) return;
    if (captureCard) exitCaptureMode();

    captureScrollY = window.scrollY;
    capturePlaceholder = document.createComment("p1008-people-card-placeholder");
    card.before(capturePlaceholder);
    document.body.append(card);

    captureCard = card;
    card.classList.add("is-capture-mode");
    document.body.classList.add("p1008-capture-active");
    setCaptureButtonState(button, true);
    card.querySelector(".p1008-table-wrap")?.scrollTo({ top: 0, left: 0 });

    if (card.requestFullscreen) {
      try {
        nativeFullscreenRequested = true;
        const request = card.requestFullscreen({ navigationUI: "hide" });
        Promise.resolve(request).catch(() => {
          nativeFullscreenRequested = false;
        });
      } catch {
        nativeFullscreenRequested = false;
      }
    }
  }

  function toggleCaptureMode(card, button) {
    if (captureCard === card) exitCaptureMode();
    else enterCaptureMode(card, button);
  }

  function ensureCaptureButton(peopleCard) {
    const header = peopleCard.querySelector(":scope > header");
    if (!header) return;

    let actions = header.querySelector(".p1008-people-header-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "p1008-people-header-actions";
      const month = header.querySelector(":scope > span");
      if (month) actions.append(month);
      header.append(actions);
    }

    if (actions.querySelector("[data-p1008-fullscreen]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "p1008-fullscreen-button";
    button.dataset.p1008Fullscreen = "true";
    button.setAttribute("aria-pressed", "false");
    button.title = "Xem toàn màn hình để chụp bảng";

    const icon = document.createElement("span");
    icon.className = "p1008-fullscreen-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⛶";

    const label = document.createElement("span");
    label.className = "p1008-fullscreen-label";
    label.textContent = "Toàn màn hình";

    button.append(icon, label);
    button.addEventListener("click", () => toggleCaptureMode(peopleCard, button));
    actions.append(button);
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
    ensureCaptureButton(peopleCard);
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && captureCard) exitCaptureMode();
  });

  document.addEventListener("fullscreenchange", () => {
    if (captureCard && nativeFullscreenRequested && !document.fullscreenElement) {
      exitCaptureMode({ skipFullscreenExit: true });
    }
  });

  queueMicrotask(refineP1008Layout);
})();