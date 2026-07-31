(() => {
  const JOURNEY_VERSION = "journey-v4";
  const CORE_SCRIPT = [
    "joy-ielts-core-bundle-v4",
    "project-data/ielts/ielts-core-bundle.js?v=ielts-journey-v4",
  ];
  const HUB_STYLE = [
    "joy-ielts-hub-v1",
    "/project-data/ielts/ielts-hub.css?v=ielts-hub-v1",
  ];
  let hubFrame = 0;

  function loadScript(id, src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`#${id}`);
      if (existing) {
        if (window.JoyIELTS?.version === JOURNEY_VERSION) resolve();
        else {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
        }
        return;
      }
      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.body.append(script);
    });
  }

  function ensureHubStyle() {
    const [id, href] = HUB_STYLE;
    if (document.querySelector(`#${id}`)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }

  function directChild(parent, selector) {
    return [...parent.children].find((child) => child.matches(selector)) || null;
  }

  function enhanceHub() {
    ensureHubStyle();
    const modal = document.querySelector("#ielts-modal");
    if (!modal) return;

    const title = modal.querySelector(".ielts-title");
    const eyebrow = title?.querySelector("small");
    const heading = title?.querySelector("h2");
    if (eyebrow) eyebrow.textContent = "IELTS LEARNING HUB";
    if (heading) heading.textContent = "IELTS Band 7";

    const overviewTab = modal.querySelector('[data-ielts-tab="now"]');
    if (overviewTab) overviewTab.textContent = "Overview";

    const body = modal.querySelector("#ielts-body");
    if (!body) return;
    const overviewActive = modal.querySelector('[data-ielts-tab="now"]')?.classList.contains("active");
    body.classList.toggle("ielts-hub-overview-active", Boolean(overviewActive));
    if (!overviewActive || directChild(body, ".ielts-overview-grid")) return;

    const hero = directChild(body, ".ielts-now-hero");
    if (!hero) return;

    const grid = document.createElement("section");
    grid.className = "ielts-overview-grid";
    const visual = document.createElement("div");
    visual.className = "ielts-overview-visual";
    visual.setAttribute("aria-hidden", "true");
    const summary = document.createElement("div");
    summary.className = "ielts-overview-summary";

    body.insertBefore(grid, hero);
    grid.append(visual, summary);
    summary.append(hero);

    const progress = directChild(body, ".ielts-rhythm-progress");
    const next = directChild(body, ".ielts-next");
    const action = directChild(body, ".ielts-action-panel");
    if (progress) summary.append(progress);
    if (next) summary.append(next);
    if (action) summary.append(action);
  }

  function scheduleHubEnhancement() {
    if (hubFrame) return;
    hubFrame = requestAnimationFrame(() => {
      hubFrame = 0;
      enhanceHub();
    });
  }

  async function ensureCore() {
    ensureHubStyle();
    if (window.JoyIELTS?.version === JOURNEY_VERSION) {
      scheduleHubEnhancement();
      return true;
    }
    try {
      await loadScript(...CORE_SCRIPT);
      scheduleHubEnhancement();
      return window.JoyIELTS?.version === JOURNEY_VERSION;
    } catch (error) {
      console.error("IELTS Journey could not load", error);
      return false;
    }
  }

  async function openIelts(event) {
    event?.preventDefault();
    event?.stopPropagation();
    event?.stopImmediatePropagation();
    if (await ensureCore()) {
      window.JoyIELTS.open();
      scheduleHubEnhancement();
    }
  }

  function bindOpenHandler(card) {
    if (card.dataset.ieltsJourneyV4Bound === "true") return;
    card.dataset.ieltsJourneyV4Bound = "true";
    card.addEventListener("click", openIelts, true);
    card.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      void openIelts(event);
    }, true);
  }

  function enhanceCard() {
    document.querySelectorAll("#project-list .project-card").forEach((card) => {
      const title = card.querySelector(".project-top > strong");
      if (title?.textContent.trim().toLowerCase() !== "ielts") return;

      card.dataset.ieltsCard = "true";
      card.classList.add("ielts-project-card");
      card.classList.remove("project-card-has-details");
      card.removeAttribute("data-project-detail-key");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Open IELTS Band 7 Journey");
      bindOpenHandler(card);

      const labels = card.querySelectorAll("dl dt");
      if (labels[0]) labels[0].textContent = "CURRENT RHYTHM";
      if (labels[1]) labels[1].textContent = "NEXT TASK";

      let subtitle = card.querySelector(".ielts-subtitle");
      if (!subtitle) {
        subtitle = document.createElement("small");
        subtitle.className = "ielts-subtitle";
        title.insertAdjacentElement("afterend", subtitle);
      }
      subtitle.textContent = "Band 7 by December · ChatGPT teaches, Joy remembers";

      const pills = [...card.querySelectorAll(".ielts-target-pill")];
      let pill = pills.shift();
      pills.forEach((duplicate) => duplicate.remove());
      if (!pill) {
        pill = document.createElement("span");
        pill.className = "ielts-target-pill";
        card.append(pill);
      }
      pill.textContent = "Target Band 7.0";

      let source = card.querySelector(".ielts-project-source");
      if (!source) {
        source = document.createElement("small");
        source.className = "ielts-project-source";
        card.append(source);
      }
      source.textContent = "August baseline 1–2 Aug · 3 rhythms each week";
      window.JoyIELTS?.refreshCard?.();
    });
  }

  const projectList = document.querySelector("#project-list");
  if (projectList) {
    new MutationObserver(() => {
      enhanceCard();
      window.JoyIELTS?.refreshCard?.();
    }).observe(projectList, { childList: true });
  }

  new MutationObserver(scheduleHubEnhancement).observe(document.body, {
    childList: true,
    subtree: true,
  });

  ensureHubStyle();
  enhanceCard();
  scheduleHubEnhancement();
  void ensureCore().then(() => {
    enhanceCard();
    scheduleHubEnhancement();
    window.JoyIELTS?.refreshCard?.();
  });
})();
