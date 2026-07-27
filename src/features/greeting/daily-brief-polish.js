(() => {
  const styleId = "joy-daily-brief-polish-v1";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    html body .joy-brief.daily-brief-news-first .joy-message {
      padding-bottom: 16px !important;
    }

    html body .joy-brief.daily-brief-news-first .joy-message > .daily-brief-personal {
      position: absolute !important;
      left: 2px !important;
      right: 2px !important;
      bottom: 7px !important;
      display: block !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      border: 0 !important;
      color: rgba(82, 98, 105, 0.56) !important;
      font-size: 8.25px !important;
      font-weight: 650 !important;
      line-height: 1.15 !important;
      letter-spacing: 0 !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      pointer-events: none !important;
    }

    @media (max-width: 760px) {
      html body .joy-brief.daily-brief-news-first .joy-message {
        padding-bottom: 15px !important;
      }

      html body .joy-brief.daily-brief-news-first .joy-message > .daily-brief-personal {
        bottom: 6px !important;
        font-size: 7.75px !important;
      }
    }
  `;

  document.head.append(style);
})();
