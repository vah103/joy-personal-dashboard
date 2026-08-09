(() => {
  if (window.__joyVocabularyLibraryInstalled) return;
  window.__joyVocabularyLibraryInstalled = true;

  const API_ROOT = "/api/vocabulary";
  const state = {
    words: [],
    query: "",
    loading: false,
    loaded: false,
    error: "",
  };

  const modal = createModal();
  document.body.append(modal);

  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeydown);

  function createModal() {
    const element = document.createElement("div");
    element.className = "modal-backdrop vocabulary-library-backdrop";
    element.dataset.vocabLibraryModal = "true";
    element.hidden = true;
    element.innerHTML = `
      <section class="modal vocabulary-library-modal" role="dialog" aria-modal="true" aria-labelledby="vocabulary-library-title">
        <div class="modal-heading vocabulary-library-heading">
          <div>
            <p class="section-kicker">Vocabulary</p>
            <h2 id="vocabulary-library-title">Saved words</h2>
            <small>Every saved entry belongs to the flashcard deck.</small>
          </div>
          <button type="button" aria-label="Close saved vocabulary" data-vocab-close-library>×</button>
        </div>
        <div class="vocabulary-library-toolbar">
          <label class="vocabulary-library-search">
            <span>Search saved words</span>
            <input type="search" autocomplete="off" placeholder="English, Vietnamese or IPA" data-vocab-library-search>
          </label>
          <div class="vocabulary-library-toolbar-actions">
            <button class="secondary-button" type="button" data-vocab-library-add>+ Add word</button>
            <button class="primary-button" type="button" data-vocab-library-practice>Practice deck</button>
          </div>
        </div>
        <div class="vocabulary-library-summary" data-vocab-library-summary></div>
        <div class="vocabulary-library-content" data-vocab-library-content></div>
      </section>
    `;
    element.addEventListener("mousedown", (event) => {
      if (event.target === element) closeLibrary();
    });
    return element;
  }

  async function openLibrary() {
    closeOtherVocabularyModals();
    modal.hidden = false;
    document.body.classList.add("modal-open");
    render();
    await loadWords();
    window.setTimeout(() => modal.querySelector("[data-vocab-library-search]")?.focus(), 0);
  }

  function closeLibrary() {
    modal.hidden = true;
    state.query = "";
    const search = modal.querySelector("[data-vocab-library-search]");
    if (search) search.value = "";
    releaseModalLock();
  }

  function closeOtherVocabularyModals() {
    document.querySelectorAll("[data-vocab-lookup-modal], [data-vocab-practice-modal]").forEach((item) => {
      item.hidden = true;
    });
  }

  function releaseModalLock() {
    if (![...document.querySelectorAll(".modal-backdrop")].some((item) => !item.hidden)) {
      document.body.classList.remove("modal-open");
    }
  }

  async function loadWords() {
    if (state.loading) return;
    state.loading = true;
    state.error = "";
    render();
    try {
      const response = await window.fetch(API_ROOT, { credentials: "same-origin" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Vocabulary request failed with ${response.status}`);
      state.words = Array.isArray(payload.words) ? payload.words.map(normalizeWord).filter(Boolean) : [];
      state.loaded = true;
    } catch (error) {
      state.error = error?.message || "Vocabulary library is unavailable.";
    } finally {
      state.loading = false;
      render();
    }
  }

  function normalizeWord(value) {
    if (!value || typeof value !== "object") return null;
    const english = clean(value.english).toLowerCase();
    const vietnamese = clean(value.vietnamese);
    if (!english || !vietnamese) return null;
    return {
      id: clean(value.id),
      english,
      partOfSpeech: clean(value.partOfSpeech || value.part_of_speech),
      vietnamese,
      ipa: clean(value.ipa),
      pronunciationVi: clean(value.pronunciationVi || value.pronunciation_vi),
      reviewCount: Number(value.reviewCount || value.review_count || 0),
      correctCount: Number(value.correctCount || value.correct_count || 0),
      updatedAt: Number(value.updatedAt || value.updated_at || 0),
    };
  }

  function filteredWords() {
    const query = normalizeSearch(state.query);
    if (!query) return state.words;
    return state.words.filter((word) => normalizeSearch([
      word.english,
      word.partOfSpeech,
      word.vietnamese,
      word.ipa,
      word.pronunciationVi,
    ].join(" ")).includes(query));
  }

  function render() {
    renderSummary();
    const content = modal.querySelector("[data-vocab-library-content]");
    if (!content) return;

    if (state.loading && !state.loaded) {
      content.innerHTML = `<div class="vocabulary-library-state"><span aria-hidden="true">Aa</span><p>Loading saved words…</p></div>`;
      return;
    }

    if (state.error && !state.loaded) {
      content.innerHTML = `
        <div class="vocabulary-library-state is-error">
          <span aria-hidden="true">!</span>
          <p>${escapeHtml(readableError(state.error))}</p>
          <button class="secondary-button" type="button" data-vocab-library-retry>Try again</button>
        </div>
      `;
      return;
    }

    if (!state.words.length) {
      content.innerHTML = `
        <div class="vocabulary-library-state">
          <span aria-hidden="true">Aa</span>
          <p>No saved words yet. Add a word to create your flashcard deck.</p>
          <button class="primary-button" type="button" data-vocab-library-add>+ Add first word</button>
        </div>
      `;
      return;
    }

    const words = filteredWords();
    if (!words.length) {
      content.innerHTML = `<div class="vocabulary-library-state"><span aria-hidden="true">⌕</span><p>No saved word matches “${escapeHtml(state.query)}”.</p></div>`;
      return;
    }

    content.innerHTML = `
      <div class="vocabulary-library-table-wrap">
        <table class="vocabulary-library-table">
          <thead>
            <tr>
              <th scope="col">English</th>
              <th scope="col">Vietnamese</th>
              <th scope="col">Pronunciation</th>
              <th scope="col">Progress</th>
              <th scope="col"><span class="sr-only">Audio</span></th>
            </tr>
          </thead>
          <tbody>
            ${words.map(renderRow).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderSummary() {
    const summary = modal.querySelector("[data-vocab-library-summary]");
    if (!summary) return;
    const reviewed = state.words.filter((word) => word.reviewCount > 0).length;
    const totalReviews = state.words.reduce((total, word) => total + word.reviewCount, 0);
    const totalCorrect = state.words.reduce((total, word) => total + word.correctCount, 0);
    const accuracy = totalReviews ? `${Math.round((totalCorrect / totalReviews) * 100)}% accuracy` : "Not reviewed yet";
    summary.innerHTML = `
      <span><strong>${state.words.length}</strong> saved</span>
      <span><strong>${reviewed}</strong> reviewed</span>
      <span>${escapeHtml(accuracy)}</span>
      <small>Flashcards use this same saved list.</small>
    `;
  }

  function renderRow(word) {
    const meanings = word.vietnamese.split(/\s*;\s*/).filter(Boolean);
    const progress = word.reviewCount
      ? `${word.reviewCount} review${word.reviewCount === 1 ? "" : "s"} · ${Math.round((word.correctCount / word.reviewCount) * 100)}%`
      : "Not reviewed";
    return `
      <tr data-vocab-library-word="${escapeHtml(word.id)}">
        <td data-label="English">
          <strong>${escapeHtml(word.english)}</strong>
          ${word.partOfSpeech ? `<small>${escapeHtml(word.partOfSpeech)}</small>` : ""}
        </td>
        <td data-label="Vietnamese">
          <div class="vocabulary-library-meanings">${meanings.map((meaning) => `<span>${escapeHtml(meaning)}</span>`).join("")}</div>
        </td>
        <td data-label="Pronunciation">
          <strong>${escapeHtml(word.ipa || "—")}</strong>
          <small>${escapeHtml(word.pronunciationVi || "—")}</small>
        </td>
        <td data-label="Progress"><span class="vocabulary-library-progress ${word.reviewCount ? "has-review" : ""}">${escapeHtml(progress)}</span></td>
        <td class="vocabulary-library-audio-cell">
          <button type="button" data-vocab-library-speak="${escapeHtml(word.english)}" aria-label="Hear ${escapeHtml(word.english)}">🔊</button>
        </td>
      </tr>
    `;
  }

  function handleClick(event) {
    const control = event.target.closest("button, [data-vocab-open-library]");
    if (!control) return;
    if (control.matches("[data-vocab-open-library]")) {
      event.preventDefault();
      openLibrary();
      return;
    }
    if (control.matches("[data-vocab-close-library]")) closeLibrary();
    if (control.matches("[data-vocab-library-retry]")) loadWords();
    if (control.matches("[data-vocab-library-add]")) openLookup();
    if (control.matches("[data-vocab-library-practice]")) openPractice();
    if (control.matches("[data-vocab-library-speak]")) speak(control.dataset.vocabLibrarySpeak);
  }

  function handleInput(event) {
    const input = event.target.closest("[data-vocab-library-search]");
    if (!input) return;
    state.query = input.value;
    render();
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && !modal.hidden) closeLibrary();
  }

  function openLookup() {
    closeLibrary();
    window.setTimeout(() => document.querySelector("[data-vocab-open-lookup]")?.click(), 0);
  }

  function openPractice() {
    closeLibrary();
    window.setTimeout(() => document.querySelector("[data-vocab-open-practice]")?.click(), 0);
  }

  function speak(text) {
    const entry = clean(text);
    if (!entry || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  function readableError(message) {
    if (/UNAUTHENTICATED/i.test(message)) return "Your Joy session expired. Refresh and sign in again.";
    return "Joy could not load your saved vocabulary right now.";
  }

  function normalizeSearch(value) {
    return clean(value).toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  }

  function clean(value) {
    return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.JoyVocabularyLibrary = Object.freeze({ open: openLibrary, refresh: loadWords });
})();
