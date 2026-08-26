(() => {
  const DESKTOP_ROOT_SELECTOR = '[data-vocab-practice-root="desktop"]';
  const UPDATE_EVENT = "joy:vocabulary-practice-updated";
  let hydrated = false;

  function fallbackShellMarkup() {
    return `
      <section class="vocabulary-compact-card is-loading" aria-label="Vocabulary" data-vocab-compact-shell>
        <div class="vocabulary-compact-topline" role="button" tabindex="0">
          <div class="vocabulary-compact-title">
            <strong>Words</strong>
            <span class="vocabulary-compact-dynamic" data-vocab-compact-count>…</span>
          </div>
        </div>
        <button class="vocabulary-compact-preview" type="button" data-vocab-open-practice disabled>
          <strong class="vocabulary-compact-dynamic" data-vocab-compact-prompt>&nbsp;</strong>
        </button>
        <div class="vocabulary-compact-empty" data-vocab-compact-empty hidden>
          <small class="vocabulary-compact-dynamic">Add a word</small>
        </div>
      </section>
    `;
  }

  function ensureShell() {
    const root = document.querySelector(DESKTOP_ROOT_SELECTOR);
    if (!root) return null;
    let card = root.querySelector("[data-vocab-compact-shell]");
    if (!card) {
      root.innerHTML = fallbackShellMarkup();
      card = root.querySelector("[data-vocab-compact-shell]");
    }
    return card;
  }

  function normalizeSnapshot(snapshot) {
    const count = Math.max(0, Number(snapshot?.count || 0));
    const prompt = cleanText(snapshot?.prompt);
    return {
      loading: Boolean(snapshot?.loading),
      count,
      prompt,
      hasWords: count > 0 && Boolean(prompt),
    };
  }

  function applySnapshot(snapshot) {
    const card = ensureShell();
    if (!card) return;

    const next = normalizeSnapshot(snapshot);
    const count = card.querySelector("[data-vocab-compact-count]");
    const prompt = card.querySelector("[data-vocab-compact-prompt]");
    const preview = card.querySelector(".vocabulary-compact-preview");
    const empty = card.querySelector("[data-vocab-compact-empty]");

    if (count) count.textContent = next.loading && !next.count ? "…" : String(next.count);
    if (prompt) prompt.textContent = next.hasWords ? next.prompt : "\u00a0";

    if (preview) {
      preview.hidden = !next.hasWords && !next.loading;
      preview.disabled = !next.hasWords;
    }

    if (empty) empty.hidden = next.hasWords || next.loading;

    card.classList.toggle("is-loading", next.loading && !next.hasWords);
    if (!hydrated) {
      hydrated = true;
      window.requestAnimationFrame(() => card.classList.add("is-ready"));
    } else {
      card.classList.add("is-ready");
    }
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  window.addEventListener(UPDATE_EVENT, (event) => applySnapshot(event.detail));
  applySnapshot(window.JoyVocabulary?.getPracticeSnapshot?.() || { loading: true, count: 0, prompt: "" });
})();
