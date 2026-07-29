(() => {
  const mobilePractice = document.querySelector("[data-vocab-practice-modal]");
  const topWidgets = document.querySelector(".top-widgets");
  const mobileCard = mobilePractice?.querySelector(".vocabulary-mobile-modal");
  if (!mobilePractice || !topWidgets || !mobileCard) return;

  const mobileMedia = window.matchMedia("(max-width: 760px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const lookupModal = document.querySelector("[data-vocab-lookup-modal]");

  mobilePractice.className = "vocabulary-mobile-inline";
  mobilePractice.dataset.vocabPracticeInline = "true";
  delete mobilePractice.dataset.vocabPracticeModal;
  mobileCard.removeAttribute("role");
  mobileCard.removeAttribute("aria-modal");
  mobileCard.removeAttribute("aria-labelledby");
  mobileCard.querySelector(":scope > .modal-heading")?.remove();
  topWidgets.insertAdjacentElement("afterend", mobilePractice);

  const style = document.createElement("style");
  style.dataset.joyVocabularyMobileInline = "true";
  style.textContent = `
    .vocabulary-mobile-inline { display: none; }
    @media (max-width: 760px) {
      .vocabulary-mobile-inline {
        display: block;
        margin: 14px 0 18px;
        scroll-margin-top: 16px;
      }
      .vocabulary-mobile-inline[hidden] { display: none !important; }
      .vocabulary-mobile-inline > .vocabulary-mobile-modal {
        width: 100%;
        max-width: none;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }
      .vocabulary-mobile-inline [data-vocab-practice-root] {
        overflow: hidden;
        border: 1px solid rgba(66, 72, 74, 0.14);
        border-radius: 18px;
        background: rgba(247, 246, 242, 0.66);
        box-shadow: inset 0 1px rgba(255, 255, 255, 0.52);
      }
    }
  `;
  document.head.append(style);

  function syncVisibility() {
    mobilePractice.hidden = !mobileMedia.matches;
    if (!mobileMedia.matches) document.body.classList.remove("modal-open");
  }

  mobileMedia.addEventListener?.("change", syncVisibility);

  mobilePractice.addEventListener("mousedown", (event) => {
    if (event.target === mobilePractice) event.stopImmediatePropagation();
  }, { capture: true });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-vocab-open-practice]");
    if (!trigger || !mobileMedia.matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();
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
    if (event.key !== "Escape" || !mobileMedia.matches || mobilePractice.hidden) return;
    const hasOpenModal = [...document.querySelectorAll(".modal-backdrop")]
      .some((modal) => !modal.hidden);
    if (!hasOpenModal) {
      event.stopImmediatePropagation();
      return;
    }

    // Keep the legacy vocabulary Escape handler from hiding the inline card
    // while still allowing the active modal to handle Escape normally.
    mobilePractice.hidden = true;
    window.setTimeout(syncVisibility, 0);
  }, { capture: true });

  if (lookupModal) {
    new MutationObserver(() => {
      if (lookupModal.hidden) syncVisibility();
    }).observe(lookupModal, { attributes: true, attributeFilter: ["hidden"] });
  }

  syncVisibility();
})();
