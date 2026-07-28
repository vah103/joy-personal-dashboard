(() => {
  const API_ROOT = "/api/vocabulary";
  const LOCAL_STORAGE_KEY = "joy-vocabulary-cache-v1";
  const scratchpad = document.querySelector(".scratchpad");
  if (!scratchpad) return;

  const state = {
    words: loadLocalWords(),
    loading: true,
    currentId: "",
    direction: "vi-en",
    lookupResult: null,
    lookupBusy: false,
    saveBusy: false,
    reviewRecorded: false,
    nextTimer: null,
  };

  scratchpad.className = "vocabulary-widget";
  scratchpad.setAttribute("aria-label", "Vocabulary flashcards");
  scratchpad.innerHTML = '<div data-vocab-practice-root="desktop"></div>';

  const lookupModal = createLookupModal();
  const mobilePracticeModal = createMobilePracticeModal();
  document.body.append(lookupModal, mobilePracticeModal);
  addMobileNavigationButton();

  document.addEventListener("submit", handleSubmit);
  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);

  renderPracticeRoots();
  loadWords();

  function createLookupModal() {
    const modal = document.createElement("div");
    modal.className = "modal-backdrop vocabulary-modal-backdrop";
    modal.dataset.vocabLookupModal = "true";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="modal vocabulary-lookup-modal" role="dialog" aria-modal="true" aria-labelledby="vocabulary-lookup-title">
        <div class="modal-heading">
          <div><p class="section-kicker">Vocabulary</p><h2 id="vocabulary-lookup-title">Add one word</h2></div>
          <button type="button" aria-label="Close vocabulary lookup" data-vocab-close-lookup>×</button>
        </div>
        <form class="vocabulary-lookup-form" data-vocab-lookup-form>
          <label for="vocabulary-lookup-input">English or Vietnamese word</label>
          <div class="vocabulary-lookup-row">
            <input id="vocabulary-lookup-input" name="query" type="text" maxlength="80" autocomplete="off" placeholder="e.g. abandon or từ bỏ" required>
            <button class="primary-button" type="submit">Look up</button>
          </div>
        </form>
        <p class="vocabulary-lookup-status" data-vocab-lookup-status aria-live="polite"></p>
        <div data-vocab-lookup-result></div>
      </section>
    `;
    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) closeLookupModal();
    });
    return modal;
  }

  function createMobilePracticeModal() {
    const modal = document.createElement("div");
    modal.className = "modal-backdrop vocabulary-mobile-modal-backdrop";
    modal.dataset.vocabPracticeModal = "true";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="modal vocabulary-mobile-modal" role="dialog" aria-modal="true" aria-labelledby="vocabulary-mobile-title">
        <div class="modal-heading">
          <div><p class="section-kicker">Quick practice</p><h2 id="vocabulary-mobile-title">Vocabulary</h2></div>
          <button type="button" aria-label="Close vocabulary practice" data-vocab-close-practice>×</button>
        </div>
        <div data-vocab-practice-root="mobile"></div>
      </section>
    `;
    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) closePracticeModal();
    });
    return modal;
  }

  function addMobileNavigationButton() {
    const nav = document.querySelector(".mobile-nav");
    if (!nav || nav.querySelector("[data-vocab-open-practice]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vocabulary-mobile-nav-button";
    button.dataset.vocabOpenPractice = "true";
    button.innerHTML = "<small>Words</small>";
    button.setAttribute("aria-label", "Open vocabulary practice");
    nav.append(button);
  }

  function loadLocalWords() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY));
      return Array.isArray(saved) ? saved.map(normalizeWord).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function saveLocalWords() {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.words));
    } catch {
      // The cloud copy remains authoritative when local storage is unavailable.
    }
  }

  function normalizeWord(word) {
    if (!word || typeof word !== "object") return null;
    const english = cleanText(word.english).toLowerCase();
    const vietnamese = cleanText(word.vietnamese);
    if (!english || !vietnamese) return null;
    return {
      id: cleanText(word.id) || `${english}-${Date.now()}`,
      english,
      vietnamese,
      ipa: cleanText(word.ipa),
      pronunciationVi: cleanText(word.pronunciationVi || word.pronunciation_vi),
      example: cleanText(word.example),
      reviewCount: Number(word.reviewCount || word.review_count || 0),
      correctCount: Number(word.correctCount || word.correct_count || 0),
      createdAt: Number(word.createdAt || word.created_at || Date.now()),
      updatedAt: Number(word.updatedAt || word.updated_at || Date.now()),
    };
  }

  async function loadWords() {
    state.loading = true;
    renderPracticeRoots();
    try {
      const payload = await requestJson(API_ROOT);
      state.words = Array.isArray(payload.words) ? payload.words.map(normalizeWord).filter(Boolean) : [];
      saveLocalWords();
    } catch {
      // Keep the last local cache so flashcards remain available during a temporary outage.
    } finally {
      state.loading = false;
      ensureCurrentWord();
      renderPracticeRoots();
    }
  }

  function ensureCurrentWord() {
    if (!state.words.length) {
      state.currentId = "";
      return;
    }
    if (!state.words.some((word) => word.id === state.currentId)) pickNextWord();
  }

  function pickNextWord() {
    window.clearTimeout(state.nextTimer);
    const candidates = state.words.length > 1
      ? state.words.filter((word) => word.id !== state.currentId)
      : state.words;
    const next = candidates[Math.floor(Math.random() * candidates.length)] || state.words[0];
    state.currentId = next?.id || "";
    state.direction = Math.random() < 0.5 ? "vi-en" : "en-vi";
    state.reviewRecorded = false;
  }

  function currentWord() {
    return state.words.find((word) => word.id === state.currentId) || null;
  }

  function practiceMarkup() {
    const count = state.words.length;
    if (state.loading && !count) {
      return `
        <div class="vocabulary-widget-heading"><div><strong>Vocabulary</strong><small>Loading saved words…</small></div></div>
        <div class="vocabulary-empty"><span aria-hidden="true">Aa</span><p>Preparing your flashcards.</p></div>
      `;
    }

    if (!count) {
      return `
        <div class="vocabulary-widget-heading">
          <div><strong>Vocabulary</strong><small>No saved words</small></div>
          <button type="button" data-vocab-open-lookup>+ Add</button>
        </div>
        <div class="vocabulary-empty">
          <span aria-hidden="true">Aa</span>
          <p>Add your first word to start practicing.</p>
          <button type="button" data-vocab-open-lookup>+ Add word</button>
        </div>
      `;
    }

    const word = currentWord();
    if (!word) return "";
    const prompt = state.direction === "vi-en" ? word.vietnamese : word.english;
    const target = state.direction === "vi-en" ? "English" : "Vietnamese";

    return `
      <div class="vocabulary-widget-heading">
        <div><strong>Vocabulary</strong><small>${count} saved ${count === 1 ? "word" : "words"}</small></div>
        <button type="button" data-vocab-open-lookup>+ Add</button>
      </div>
      <div class="vocabulary-practice">
        <small class="vocabulary-direction">Translate into ${target}</small>
        <strong class="vocabulary-prompt">${escapeHtml(prompt)}</strong>
        <form class="vocabulary-answer-form" data-vocab-practice-form>
          <input name="answer" type="text" autocomplete="off" placeholder="Your answer…" aria-label="Vocabulary answer" required>
          <button type="submit">Check</button>
        </form>
        <p class="vocabulary-feedback" data-vocab-feedback aria-live="polite"></p>
        <div class="vocabulary-practice-actions">
          <button type="button" data-vocab-show-answer>Show answer</button>
          <button type="button" data-vocab-next>Next →</button>
        </div>
      </div>
    `;
  }

  function renderPracticeRoots() {
    document.querySelectorAll("[data-vocab-practice-root]").forEach((root) => {
      root.innerHTML = practiceMarkup();
    });
  }

  async function handleSubmit(event) {
    const practiceForm = event.target.closest("[data-vocab-practice-form]");
    if (practiceForm) {
      event.preventDefault();
      checkAnswer(practiceForm);
      return;
    }

    const lookupForm = event.target.closest("[data-vocab-lookup-form]");
    if (lookupForm) {
      event.preventDefault();
      await lookupWord(lookupForm);
    }
  }

  async function handleClick(event) {
    const control = event.target.closest("button, [data-vocab-action]");
    if (!control) return;

    if (control.matches("[data-vocab-open-lookup]")) openLookupModal();
    if (control.matches("[data-vocab-close-lookup]")) closeLookupModal();
    if (control.matches("[data-vocab-open-practice]")) openPracticeModal();
    if (control.matches("[data-vocab-close-practice]")) closePracticeModal();
    if (control.matches("[data-vocab-show-answer]")) showAnswer(control);
    if (control.matches("[data-vocab-next]")) nextWord();
    if (control.matches("[data-vocab-no-save]")) closeLookupModal();
    if (control.matches("[data-vocab-save]")) await saveLookupResult();
    if (control.matches("[data-vocab-speak]")) speakLookupResult();
  }

  function handleKeydown(event) {
    if (event.key !== "Escape") return;
    if (!lookupModal.hidden) closeLookupModal();
    else if (!mobilePracticeModal.hidden) closePracticeModal();
  }

  function checkAnswer(form) {
    const word = currentWord();
    if (!word) return;
    const input = form.elements.answer;
    const feedback = form.parentElement.querySelector("[data-vocab-feedback]");
    const expected = state.direction === "vi-en" ? word.english : word.vietnamese;
    const correct = answersMatch(input.value, expected, state.direction === "en-vi");

    feedback.className = `vocabulary-feedback is-${correct ? "correct" : "wrong"}`;
    feedback.textContent = correct ? "Correct ✓" : "Try again";

    if (!state.reviewRecorded) {
      state.reviewRecorded = true;
      recordReview(word.id, correct);
    }

    if (correct) {
      input.disabled = true;
      state.nextTimer = window.setTimeout(nextWord, 1000);
    } else {
      input.select();
    }
  }

  function showAnswer(control) {
    const word = currentWord();
    if (!word) return;
    const root = control.closest("[data-vocab-practice-root]");
    const feedback = root?.querySelector("[data-vocab-feedback]");
    if (!feedback) return;
    const expected = state.direction === "vi-en" ? word.english : word.vietnamese;
    feedback.className = "vocabulary-feedback is-answer";
    feedback.textContent = `Answer: ${expected}`;
  }

  function nextWord() {
    if (!state.words.length) return;
    pickNextWord();
    renderPracticeRoots();
    window.setTimeout(() => {
      const visibleRoot = !mobilePracticeModal.hidden
        ? mobilePracticeModal.querySelector("[data-vocab-practice-root]")
        : scratchpad.querySelector("[data-vocab-practice-root]");
      visibleRoot?.querySelector('input[name="answer"]')?.focus();
    }, 0);
  }

  async function recordReview(id, correct) {
    try {
      await requestJson(`${API_ROOT}/review`, {
        method: "POST",
        body: JSON.stringify({ id, correct }),
      });
    } catch {
      // Review statistics should never block the flashcard interaction.
    }
  }

  function openLookupModal() {
    mobilePracticeModal.hidden = true;
    state.lookupResult = null;
    renderLookupResult();
    const status = lookupModal.querySelector("[data-vocab-lookup-status]");
    status.textContent = "";
    lookupModal.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => lookupModal.querySelector('input[name="query"]')?.focus(), 0);
  }

  function closeLookupModal() {
    lookupModal.hidden = true;
    lookupModal.querySelector("[data-vocab-lookup-form]")?.reset();
    state.lookupResult = null;
    renderLookupResult();
    releaseModalLock();
  }

  function openPracticeModal() {
    renderPracticeRoots();
    mobilePracticeModal.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => mobilePracticeModal.querySelector('input[name="answer"]')?.focus(), 0);
  }

  function closePracticeModal() {
    mobilePracticeModal.hidden = true;
    releaseModalLock();
  }

  function releaseModalLock() {
    if (![...document.querySelectorAll(".modal-backdrop")].some((modal) => !modal.hidden)) {
      document.body.classList.remove("modal-open");
    }
  }

  async function lookupWord(form) {
    if (state.lookupBusy) return;
    const query = cleanText(form.elements.query.value);
    if (!query) return;

    state.lookupBusy = true;
    state.lookupResult = null;
    renderLookupResult();
    const status = lookupModal.querySelector("[data-vocab-lookup-status]");
    const button = form.querySelector('button[type="submit"]');
    status.textContent = "Joy is finding one best match…";
    button.disabled = true;

    try {
      const payload = await requestJson(`${API_ROOT}/lookup`, {
        method: "POST",
        body: JSON.stringify({ query }),
      });
      state.lookupResult = normalizeWord(payload.word);
      if (!state.lookupResult) throw new Error("INVALID_VOCABULARY_RESULT");
      status.textContent = "One best match found.";
      renderLookupResult();
    } catch (error) {
      status.textContent = vocabularyErrorMessage(error.code || error.message);
    } finally {
      state.lookupBusy = false;
      button.disabled = false;
    }
  }

  function renderLookupResult() {
    const container = lookupModal.querySelector("[data-vocab-lookup-result]");
    const word = state.lookupResult;
    if (!container) return;
    if (!word) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <article class="vocabulary-result-card">
        <div class="vocabulary-result-main">
          <div><small>English</small><strong>${escapeHtml(word.english)}</strong></div>
          <button type="button" data-vocab-speak aria-label="Hear the English word">🔊</button>
        </div>
        <dl>
          <div><dt>Vietnamese</dt><dd>${escapeHtml(word.vietnamese)}</dd></div>
          <div><dt>IPA</dt><dd>${escapeHtml(word.ipa || "—")}</dd></div>
          <div><dt>Vietnamese reading</dt><dd>${escapeHtml(word.pronunciationVi || "—")}</dd></div>
          <div class="vocabulary-example"><dt>Example</dt><dd>${escapeHtml(word.example || "—")}</dd></div>
        </dl>
        <p>Save this word?</p>
        <div class="modal-actions vocabulary-save-actions">
          <button class="secondary-button" type="button" data-vocab-no-save>No</button>
          <button class="primary-button" type="button" data-vocab-save ${state.saveBusy ? "disabled" : ""}>Yes</button>
        </div>
      </article>
    `;
  }

  async function saveLookupResult() {
    if (!state.lookupResult || state.saveBusy) return;
    state.saveBusy = true;
    renderLookupResult();
    const status = lookupModal.querySelector("[data-vocab-lookup-status]");
    status.textContent = "Saving…";

    try {
      const payload = await requestJson(API_ROOT, {
        method: "POST",
        body: JSON.stringify(state.lookupResult),
      });
      const saved = normalizeWord(payload.word);
      if (!saved) throw new Error("VOCABULARY_SAVE_FAILED");
      const existingIndex = state.words.findIndex((word) => word.id === saved.id || word.english === saved.english);
      if (existingIndex >= 0) state.words.splice(existingIndex, 1, saved);
      else state.words.unshift(saved);
      saveLocalWords();
      state.currentId = saved.id;
      state.direction = Math.random() < 0.5 ? "vi-en" : "en-vi";
      renderPracticeRoots();
      status.textContent = payload.created === false ? "This word was already saved." : "Saved.";
      window.setTimeout(closeLookupModal, 450);
    } catch (error) {
      status.textContent = vocabularyErrorMessage(error.code || error.message);
    } finally {
      state.saveBusy = false;
      renderLookupResult();
    }
  }

  function speakLookupResult() {
    if (!state.lookupResult?.english || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.lookupResult.english);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  function vocabularyErrorMessage(code) {
    if (code === "INVALID_VOCABULARY_INPUT") return "Enter one English or Vietnamese word.";
    if (code === "VOCABULARY_AI_UNAVAILABLE") return "Vocabulary lookup is temporarily unavailable.";
    if (code === "VOCABULARY_RESULT_INVALID") return "Joy could not find one clear match. Try a more specific word.";
    if (code === "UNAUTHENTICATED") return "Your Joy session expired. Refresh and sign in again.";
    return "Joy could not complete this vocabulary request.";
  }

  async function requestJson(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await window.fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Vocabulary request failed with ${response.status}`);
      error.status = response.status;
      error.code = payload.error || "";
      throw error;
    }
    return payload;
  }

  function answersMatch(actual, expected, allowVietnameseWithoutMarks = false) {
    const normalizedActual = normalizeAnswer(actual);
    const normalizedExpected = normalizeAnswer(expected);
    if (normalizedActual === normalizedExpected) return true;
    if (!allowVietnameseWithoutMarks) return false;
    return removeVietnameseMarks(normalizedActual) === removeVietnameseMarks(normalizedExpected);
  }

  function normalizeAnswer(value) {
    return cleanText(value)
      .toLocaleLowerCase("vi")
      .replace(/[.!?;,]+$/g, "")
      .replace(/\s+/g, " ");
  }

  function removeVietnameseMarks(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  }

  function cleanText(value) {
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

  window.JoyVocabulary = Object.freeze({ normalizeAnswer, answersMatch });
})();
