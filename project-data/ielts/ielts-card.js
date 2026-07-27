(() => {
  const CORE_STYLES = [
    ["joy-ielts-core-style", "project-data/ielts/ielts-core.css?v=ielts-august-core-v3"],
    ["joy-ielts-core-polish", "project-data/ielts/ielts-core-polish.css?v=ielts-august-core-v3"],
  ];
  const CORE_SCRIPT = [
    "joy-ielts-core-bundle",
    "project-data/ielts/ielts-core-bundle.js?v=ielts-august-core-v3",
  ];

  function loadScript(id, src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`#${id}`);
      if (existing) {
        if (window.JoyIELTS || existing.dataset.loaded === "true") resolve();
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

  async function loadAugustCore() {
    if (window.JoyIELTS) return true;

    CORE_STYLES.forEach(([id, href]) => {
      if (document.querySelector(`#${id}`)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      document.head.append(link);
    });

    try {
      await loadScript(...CORE_SCRIPT);
      return Boolean(window.JoyIELTS);
    } catch (error) {
      console.error("Joy could not load IELTS August Core", error);
      const source = document.querySelector(".ielts-project-card .ielts-project-source");
      if (source) source.textContent = "August Core unavailable · refresh Joy";
      return false;
    }
  }

  async function openCoach(event) {
    event?.preventDefault();
    event?.stopImmediatePropagation();
    event?.stopPropagation();

    const ready = await loadAugustCore();
    if (ready) {
      window.JoyIELTS.open();
      return;
    }

    const source = document.querySelector(".ielts-project-card .ielts-project-source");
    if (source) source.textContent = "August Core could not start";
  }

  function bindOpenHandler(card) {
    if (card.dataset.ieltsOpenBound === "true") return;
    card.dataset.ieltsOpenBound = "true";
    card.addEventListener("click", openCoach, true);
    card.addEventListener("keydown", (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      void openCoach(event);
    }, true);
  }

  function enhanceIeltsCard() {
    document.querySelectorAll("#project-list .project-card").forEach((card) => {
      const title = card.querySelector(".project-top > strong");
      if (title?.textContent.trim().toLowerCase() !== "ielts") return;

      card.classList.add("ielts-project-card");
      card.classList.remove("project-card-has-details");
      card.removeAttribute("data-project-detail-key");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Open IELTS August Coach");
      bindOpenHandler(card);

      if (!card.querySelector(".ielts-subtitle")) {
        const subtitle = document.createElement("small");
        subtitle.className = "ielts-subtitle";
        subtitle.textContent = "August Intensive · Personal IELTS Coach";
        title.insertAdjacentElement("afterend", subtitle);
      }

      if (!card.querySelector(".ielts-target-pill")) {
        const pill = document.createElement("span");
        pill.className = "ielts-target-pill";
        pill.textContent = "Target Band 7.0";
        card.append(pill);
      }

      if (!card.querySelector(".ielts-project-source")) {
        const source = document.createElement("small");
        source.className = "ielts-project-source";
        source.textContent = window.JoyIELTS
          ? "August Core ready · Open coach"
          : "Loading August Core…";
        card.append(source);
      }
    });
  }

  const projectList = document.querySelector("#project-list");
  if (projectList) {
    new MutationObserver(enhanceIeltsCard).observe(projectList, { childList: true });
  }

  enhanceIeltsCard();
  void loadAugustCore().then(() => enhanceIeltsCard());
})();