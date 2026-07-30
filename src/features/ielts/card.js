(() => {
  const JOURNEY_VERSION = "journey-v4";
  const CORE_SCRIPT = [
    "joy-ielts-core-bundle-v4",
    "project-data/ielts/ielts-core-bundle.js?v=ielts-journey-v4",
  ];

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

  async function ensureCore() {
    if (window.JoyIELTS?.version === JOURNEY_VERSION) return true;
    try {
      await loadScript(...CORE_SCRIPT);
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
    if (await ensureCore()) window.JoyIELTS.open();
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
  enhanceCard();
  void ensureCore().then(() => {
    enhanceCard();
    window.JoyIELTS?.refreshCard?.();
  });
})();
