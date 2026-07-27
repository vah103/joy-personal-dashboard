(() => {
  const styleId = "joy-daily-brief-polish-v3";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    html body .joy-brief.daily-brief-news-first {
      min-height: 98px !important;
      padding: 10px 14px !important;
      grid-template-columns: auto minmax(0, 1fr) 16px !important;
      gap: 10px !important;
    }

    html body .joy-brief.daily-brief-news-first .brief-icon {
      width: 38px !important;
      height: 38px !important;
    }

    html body .joy-brief.daily-brief-news-first .joy-message {
      min-height: 0 !important;
      padding: 9px 14px 8px !important;
      box-sizing: border-box !important;
    }

    html body .joy-brief.daily-brief-news-first .daily-brief-stack {
      min-height: 0 !important;
    }

    html body .joy-brief.daily-brief-news-first .joy-message > .daily-brief-personal {
      position: static !important;
      display: block !important;
      min-height: 0 !important;
      margin: 5px 0 0 !important;
      padding: 4px 0 0 !important;
      overflow: hidden !important;
      border: 0 !important;
      border-top: 1px solid rgba(92, 112, 120, 0.08) !important;
      color: rgba(82, 98, 105, 0.54) !important;
      font-size: 8.25px !important;
      font-weight: 650 !important;
      line-height: 1.15 !important;
      letter-spacing: 0 !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      pointer-events: none !important;
    }

    html body .joy-brief.daily-brief-news-first .daily-brief-controls {
      width: 16px !important;
    }

    html body .joy-brief.daily-brief-news-first .daily-brief-arrow {
      width: 16px !important;
      min-width: 16px !important;
      height: 18px !important;
      font-size: 13px !important;
    }

    .daily-brief-tag[data-category="ai"] {
      background: rgba(216, 233, 240, .88) !important;
      color: #315f72 !important;
    }

    .daily-brief-tag[data-category="robotics"] {
      background: rgba(222, 232, 236, .88) !important;
      color: #405f6c !important;
    }

    .daily-brief-tag[data-category="money"] {
      background: rgba(225, 235, 228, .9) !important;
      color: #456a54 !important;
    }

    .daily-brief-tag[data-category="markets"] {
      background: rgba(235, 232, 222, .9) !important;
      color: #6d6045 !important;
    }

    @media (max-width: 760px) {
      html body .joy-brief.daily-brief-news-first {
        min-height: 94px !important;
        padding: 9px 11px !important;
        grid-template-columns: auto minmax(0, 1fr) 14px !important;
        gap: 8px !important;
      }

      html body .joy-brief.daily-brief-news-first .brief-icon {
        width: 34px !important;
        height: 34px !important;
      }

      html body .joy-brief.daily-brief-news-first .joy-message {
        padding: 8px 11px 7px !important;
      }

      html body .joy-brief.daily-brief-news-first .joy-message > .daily-brief-personal {
        margin-top: 4px !important;
        padding-top: 3px !important;
        font-size: 7.75px !important;
      }
    }
  `;

  document.head.append(style);

  const drawer = document.querySelector(".daily-brief-drawer");
  const sections = drawer ? [...drawer.querySelectorAll(".daily-brief-drawer-body > section")] : [];
  const headings = [
    "What happened",
    "Money, opportunity & risk",
    "What to watch",
  ];

  sections.slice(0, headings.length).forEach((section, index) => {
    const heading = section.querySelector("h3");
    if (heading) heading.textContent = headings[index];
  });
})();
