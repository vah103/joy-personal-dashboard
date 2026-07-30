(() => {
  function openCoach(event) {
    event?.preventDefault();
    event?.stopImmediatePropagation();
    event?.stopPropagation();
    if (window.JoyIELTS?.open) {
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
      if (!cardElement.querySelector(".ielts-metrics")) {
        const metrics = document.createElement("div");
        metrics.className = "ielts-metrics";
        metrics.innerHTML = '<span data-m="today"></span><span data-m="speaking"></span><span data-m="late"></span>';
        cardElement.append(metrics);
      }
      if (!cardElement.querySelector(".ielts-project-source")) {
        const source = document.createElement("small");
        source.className = "ielts-project-source";
        source.textContent = window.JoyIELTS ? "IELTS Coach đã sẵn sàng · Bấm để mở" : "Đang tải IELTS Coach…";
        cardElement.append(source);
      }
      window.JoyIELTS?.refreshCard?.();
    });
  }

  const projectList = document.querySelector("#project-list");
  if (projectList) new MutationObserver(enhanceIeltsCard).observe(projectList, { childList: true });
  enhanceIeltsCard();
})();
