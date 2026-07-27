(() => {
  const CORE_STYLES = [
    ["joy-ielts-core-style", "project-data/ielts/ielts-core.css?v=ielts-august-core-v3"],
    ["joy-ielts-core-polish", "project-data/ielts/ielts-core-polish.css?v=ielts-august-core-v3"],
    ["joy-ielts-diagnostic-style", "project-data/ielts/ielts-diagnostic.css?v=ielts-baseline-v2"],
    ["joy-ielts-writing-review-style", "project-data/ielts/ielts-writing-review.css?v=ielts-writing-review-v1"],
    ["joy-ielts-writing-rewrite-style", "project-data/ielts/ielts-writing-rewrite.css?v=ielts-writing-rewrite-v1"],
  ];
  const CORE_SCRIPT = [
    "joy-ielts-core-bundle",
    "project-data/ielts/ielts-core-bundle.js?v=ielts-august-core-v7",
  ];

  function ensureCoreStyles() {
    CORE_STYLES.forEach(([id, href]) => {
      if (document.querySelector(`#${id}`)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      document.head.append(link);
    });
    if (!document.querySelector("#joy-ielts-vietnamese-labels")) {
      const style = document.createElement("style");
      style.id = "joy-ielts-vietnamese-labels";
      style.textContent = '.projects-panel .project-card.ielts-project-card .project-top span::after{content:"Tiến độ"}';
      document.head.append(style);
    }
  }

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
    ensureCoreStyles();
    if (window.JoyIELTS) return true;
    try {
      await loadScript(...CORE_SCRIPT);
      return Boolean(window.JoyIELTS);
    } catch (error) {
      console.error("Joy không thể tải IELTS Coach tháng 8", error);
      const source = document.querySelector(".ielts-project-card .ielts-project-source");
      if (source) source.textContent = "IELTS Coach chưa khả dụng · hãy tải lại Joy";
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
    if (source) source.textContent = "Không thể khởi động IELTS Coach";
  }

  function bindOpenHandler(cardElement) {
    if (cardElement.dataset.ieltsOpenBound === "true") return;
    cardElement.dataset.ieltsOpenBound = "true";
    cardElement.addEventListener("click", openCoach, true);
    cardElement.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      void openCoach(event);
    }, true);
  }

  function localizeCardLabels(cardElement) {
    const labels = cardElement.querySelectorAll("dl dt");
    if (labels[0]) labels[0].textContent = "TRỌNG TÂM HIỆN TẠI";
    if (labels[1]) labels[1].textContent = "BƯỚC TIẾP THEO";
  }

  function enhanceIeltsCard() {
    document.querySelectorAll("#project-list .project-card").forEach((cardElement) => {
      const title = cardElement.querySelector(".project-top > strong");
      if (title?.textContent.trim().toLowerCase() !== "ielts") return;
      cardElement.classList.add("ielts-project-card");
      cardElement.classList.remove("project-card-has-details");
      cardElement.removeAttribute("data-project-detail-key");
      cardElement.tabIndex = 0;
      cardElement.setAttribute("role", "button");
      cardElement.setAttribute("aria-label", "Mở IELTS Coach tháng 8");
      bindOpenHandler(cardElement);
      localizeCardLabels(cardElement);

      if (!cardElement.querySelector(".ielts-subtitle")) {
        const subtitle = document.createElement("small");
        subtitle.className = "ielts-subtitle";
        subtitle.textContent = "Tăng tốc tháng 8 · Trợ lý IELTS cá nhân";
        title.insertAdjacentElement("afterend", subtitle);
      }
      if (!cardElement.querySelector(".ielts-target-pill")) {
        const pill = document.createElement("span");
        pill.className = "ielts-target-pill";
        pill.textContent = "Mục tiêu Band 7.0";
        cardElement.append(pill);
      }
      if (!cardElement.querySelector(".ielts-project-source")) {
        const source = document.createElement("small");
        source.className = "ielts-project-source";
        source.textContent = window.JoyIELTS ? "IELTS Coach đã sẵn sàng · Bấm để mở" : "Đang tải IELTS Coach…";
        cardElement.append(source);
      }
    });
  }

  ensureCoreStyles();
  const projectList = document.querySelector("#project-list");
  if (projectList) new MutationObserver(enhanceIeltsCard).observe(projectList, { childList: true });
  enhanceIeltsCard();
  void loadAugustCore().then(() => enhanceIeltsCard());
})();
