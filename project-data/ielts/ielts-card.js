(() => {
  const CORE_STYLE_ID = "joy-ielts-core-style";
  const CORE_SCRIPT_ID = "joy-ielts-core-script";

  function loadAugustCore() {
    if (!document.querySelector(`#${CORE_STYLE_ID}`)) {
      const link = document.createElement("link");
      link.id = CORE_STYLE_ID;
      link.rel = "stylesheet";
      link.href = "project-data/ielts/ielts-core.css?v=ielts-august-core-v1";
      document.head.append(link);
    }

    if (!document.querySelector(`#${CORE_SCRIPT_ID}`)) {
      const script = document.createElement("script");
      script.id = CORE_SCRIPT_ID;
      script.src = "project-data/ielts/ielts-core.js?v=ielts-august-core-v1";
      script.defer = true;
      document.body.append(script);
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
    new MutationObserver(enhanceIeltsCard).observe(projectList, {
      childList: true,
    });
  }

  enhanceIeltsCard();
  loadAugustCore();
})();