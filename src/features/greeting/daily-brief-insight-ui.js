(() => {
  const styleId = "joy-daily-brief-insight-ui-v1";

  function applyInsightUi() {
    const drawer = document.querySelector(".daily-brief-drawer");
    if (!drawer) return false;

    const sections = [...drawer.querySelectorAll(".daily-brief-drawer-body > section")];
    const headings = [
      "What happened",
      "Money, opportunity & risk",
      "What to watch",
    ];

    sections.slice(0, headings.length).forEach((section, index) => {
      const heading = section.querySelector("h3");
      if (heading) heading.textContent = headings[index];
    });

    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .daily-brief-tag[data-category="ai"] {
          background: rgba(216, 233, 240, .88);
          color: #315f72;
        }
        .daily-brief-tag[data-category="robotics"] {
          background: rgba(222, 232, 236, .88);
          color: #405f6c;
        }
        .daily-brief-tag[data-category="money"] {
          background: rgba(225, 235, 228, .9);
          color: #456a54;
        }
        .daily-brief-tag[data-category="markets"] {
          background: rgba(235, 232, 222, .9);
          color: #6d6045;
        }
      `;
      document.head.append(style);
    }

    return true;
  }

  if (applyInsightUi()) return;

  const observer = new MutationObserver(() => {
    if (applyInsightUi()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
