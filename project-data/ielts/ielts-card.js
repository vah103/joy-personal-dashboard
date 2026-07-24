(() => {
  function enhanceIeltsCard() {
    document.querySelectorAll("#project-list .project-card").forEach((card) => {
      const title = card.querySelector(".project-top > strong");
      if (title?.textContent.trim().toLowerCase() !== "ielts") return;

      card.classList.add("ielts-project-card");

      if (!card.querySelector(".ielts-subtitle")) {
        const subtitle = document.createElement("small");
        subtitle.className = "ielts-subtitle";
        subtitle.textContent = "Band 7.0 target project";
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
        source.textContent = "Study log live · Open project hub";
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
})();