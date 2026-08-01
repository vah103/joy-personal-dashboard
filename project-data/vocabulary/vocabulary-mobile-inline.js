(() => {
  const MOBILE_BREAKPOINT = 760;
  const mobileMedia = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  let renderScheduled = false;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
  }

  function isMobileLayout() {
    const screenWidth = Number(window.screen?.width || Number.POSITIVE_INFINITY);
    const screenHeight = Number(window.screen?.height || Number.POSITIVE_INFINITY);
    const shortestScreenSide = Math.min(screenWidth, screenHeight);
    return mobileMedia.matches
      || ((coarsePointer.matches || isStandalone()) && shortestScreenSide <= MOBILE_BREAKPOINT);
  }

  function installMobileLauncher(attempt = 0) {
    const topWidgets = document.querySelector(".top-widgets");
    const vocabularyWidget = document.querySelector(".vocabulary-widget");
    const compactCard = vocabularyWidget?.querySelector(".vocabulary-compact-card");
    const practiceModal = document.querySelector("[data-vocab-practice-modal]");

    if (!topWidgets || !vocabularyWidget || !compactCard || !practiceModal) {
      if (attempt < 120) {
        window.requestAnimationFrame(() => installMobileLauncher(attempt + 1));
      }
      return;
    }

    let launcher = document.querySelector('[data-vocab-mobile-launcher="true"]');
    if (!launcher) {
      launcher = document.createElement("div");
      launcher.className = "vocabulary-mobile-inline";
      launcher.dataset.vocabMobileLauncher = "true";
      topWidgets.insertAdjacentElement("afterend", launcher);
    }

    ensureStyles();

    function syncLauncher() {
      renderScheduled = false;
      const source = vocabularyWidget.querySelector(".vocabulary-compact-card");
      if (!source) return;
      const clone = source.cloneNode(true);
      clone.classList.add("vocabulary-compact-card-mobile");
      launcher.replaceChildren(clone);
    }

    function scheduleLauncherSync() {
      if (renderScheduled) return;
      renderScheduled = true;
      queueMicrotask(syncLauncher);
    }

    function syncVisibility() {
      const visible = isMobileLayout();
      launcher.classList.toggle("is-mobile-layout", visible);
      launcher.hidden = !visible;
    }

    const observer = new MutationObserver(scheduleLauncherSync);
    observer.observe(vocabularyWidget, { childList: true, subtree: true });

    const registerMediaChange = (mediaQuery) => {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", syncVisibility);
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(syncVisibility);
      }
    };

    registerMediaChange(mobileMedia);
    registerMediaChange(coarsePointer);
    window.addEventListener("resize", syncVisibility, { passive: true });
    window.addEventListener("orientationchange", syncVisibility);

    syncLauncher();
    syncVisibility();
  }

  function ensureStyles() {
    if (document.querySelector('style[data-joy-vocabulary-mobile-inline="true"]')) return;
    const style = document.createElement("style");
    style.dataset.joyVocabularyMobileInline = "true";
    style.textContent = `
      .vocabulary-mobile-inline {
        display: none;
      }
      .vocabulary-mobile-inline.is-mobile-layout {
        display: block;
        margin: 14px 0 18px;
        scroll-margin-top: 16px;
      }
      .vocabulary-mobile-inline.is-mobile-layout[hidden] {
        display: none !important;
      }
      .vocabulary-mobile-inline .vocabulary-compact-card {
        width: 100%;
        min-height: 118px;
        border: 1px solid rgba(66, 72, 74, 0.14);
        border-radius: 18px;
        background: rgba(247, 246, 242, 0.66);
        box-shadow: inset 0 1px rgba(255, 255, 255, 0.52);
      }
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => installMobileLauncher(), { once: true });
  } else {
    installMobileLauncher();
  }
})();
