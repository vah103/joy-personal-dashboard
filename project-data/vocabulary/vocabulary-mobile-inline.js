(() => {
  const MOBILE_BREAKPOINT = 760;
  const mobileMedia = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let installed = false;

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

  function installMobilePractice(attempt = 0) {
    if (installed) return;

    const mobilePractice = document.querySelector("[data-vocab-practice-modal]");
    const topWidgets = document.querySelector(".top-widgets");
    const mobileCard = mobilePractice?.querySelector(".vocabulary-mobile-modal");
    if (!mobilePractice || !topWidgets || !mobileCard) {
      if (attempt < 120) {
        window.requestAnimationFrame(() => installMobilePractice(attempt + 1));
      }
      return;
    }

    installed = true;
    const lookupModal = document.querySelector("[data-vocab-lookup-modal]");

    mobilePractice.className = "vocabulary-mobile-inline";
    mobilePractice.dataset.vocabPracticeInline = "true";
    delete mobilePractice.dataset.vocabPracticeModal;
    mobileCard.removeAttribute("role");
    mobileCard.removeAttribute("aria-modal");
    mobileCard.removeAttribute("aria-labelledby");
    mobileCard.querySelector(":scope > .modal-heading")?.remove();
    topWidgets.insertAdjacentElement("afterend", mobilePractice);

    if (!document.querySelector('style[data-joy-vocabulary-mobile-inline="true"]')) {
      const style = document.createElement("style");
      style.dataset.joyVocabularyMobileInline = "true";
      style.textContent = `
        .vocabulary-mobile-inline { display: none; }
        .vocabulary-mobile-inline.is-mobile-layout {
          display: block;
          margin: 14px 0 18px;
          scroll-margin-top: 16px;
        }
        .vocabulary-mobile-inline.is-mobile-layout[hidden] { display: none !important; }
        .vocabulary-mobile-inline.is-mobile-layout > .vocabulary-mobile-modal {
          width: 100%;
          max-width: none;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }
        .vocabulary-mobile-inline.is-mobile-layout [data-vocab-practice-root] {
          overflow: hidden;
          border: 1px solid rgba(66, 72, 74, 0.14);
          border-radius: 18px;
          background: rgba(247, 246, 242, 0.66);
          box-shadow: inset 0 1px rgba(255, 255, 255, 0.52);
        }
        @media (max-width: 760px) {
          .vocabulary-mobile-inline { display: block; }
          .vocabulary-mobile-inline[hidden] { display: none !important; }
        }
      `;
      document.head.append(style);
    }

    function syncVisibility() {
      const visible = isMobileLayout();
      mobilePractice.classList.toggle("is-mobile-layout", visible);
      mobilePractice.hidden = !visible;
      if (!visible) document.body.classList.remove("modal-open");
    }

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

    mobilePractice.addEventListener("mousedown", (event) => {
      if (event.target === mobilePractice) event.stopImmediatePropagation();
    }, { capture: true });

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-vocab-open-practice]");
      if (!trigger || !isMobileLayout()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      mobilePractice.classList.add("is-mobile-layout");
      mobilePractice.hidden = false;
      mobilePractice.scrollIntoView({
        behavior: reduceMotion.matches ? "auto" : "smooth",
        block: "start",
      });
      window.setTimeout(() => {
        mobilePractice.querySelector('input[name="answer"]')?.focus({ preventScroll: true });
      }, reduceMotion.matches ? 0 : 350);
    }, { capture: true });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !isMobileLayout() || mobilePractice.hidden) return;
      const hasOpenModal = [...document.querySelectorAll(".modal-backdrop")]
        .some((modal) => !modal.hidden);
      if (!hasOpenModal) {
        event.stopImmediatePropagation();
        return;
      }

      mobilePractice.hidden = true;
      window.setTimeout(syncVisibility, 0);
    }, { capture: true });

    if (lookupModal) {
      new MutationObserver(() => {
        if (lookupModal.hidden) syncVisibility();
      }).observe(lookupModal, { attributes: true, attributeFilter: ["hidden"] });
    }

    syncVisibility();
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => installMobilePractice(), { once: true });
  } else {
    installMobilePractice();
  }
})();
