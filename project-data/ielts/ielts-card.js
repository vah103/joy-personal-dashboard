(() => {
  const CORE_STYLE_ID = "joy-ielts-core-style";
  const CORE_SCRIPT_IDS = [
    ["joy-ielts-core-model", "project-data/ielts/ielts-core-model.js?v=ielts-august-core-v1"],
    ["joy-ielts-core-ui", "project-data/ielts/ielts-core-ui.js?v=ielts-august-core-v1"],
    ["joy-ielts-core-actions", "project-data/ielts/ielts-core-actions.js?v=ielts-august-core-v1"],
  ];

  function loadScript(id, src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`#${id}`);
      if (existing) {
        if (existing.dataset.loaded === "true") resolve();
        else existing.addEventListener("load", resolve, { once: true });
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
    if (!document.querySelector(`#${CORE_STYLE_ID}`)) {
      const link = document.createElement("link");
      link.id = CORE_STYLE_ID;
      link.rel = "stylesheet";
      link.href = "project-data/ielts/ielts-core.css?v=ielts-august-core-v1";
      document.head.append(link);
    }

    try {
      for (const [id, src] of CORE_SCRIPT_IDS) await loadScript(id, src);
    } catch (error) {
      console.error("Joy could not load IELTS August Core", error);
      const source = document.querySelector(".ielts-project-card .ielts-project-source");
      if (source) source.textContent = "August Core unavailable · refresh Joy";
    }
  }

  function enhanceIeltsCard() {
    document.querySelectorAll("#project-list .project-card").forEach((card) => {
      const title = card.querySelector(".project-top > strong");
      if (title?.textContent.trim().toLowerCase() !== "ielts") return;

      card.classList.add("ielts-project-card");

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
        source.textContent = "Loading August Core…";
        card.append(source);
      }
    });
  }

  const projectList = document.querySelector("#project-list");
  if (projectList) {
    new MutationObserver(enhanceIeltsCard).observe(projectList, { childList: true });
  }

  enhanceIeltsCard();
  void loadAugustCore();
})();