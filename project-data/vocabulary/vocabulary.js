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

  function i18n() {
    return window.JoyI18n || null;
  }

  function tr(key, values = {}, fallback = "") {
    const translated = i18n()?.t?.(key, values);
    return translated && translated !== key ? translated : fallback || key;
  }

  function translateUi(value) {
    return i18n()?.translateText?.(value) || value;
  }

  scratchpad.className = "vocabulary-widget";
  scratchpad.setAttribute("aria-label", tr("vocabulary.flashcardsAria", {}, "Vocabulary flashcards"));
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
          <div><p class="section-kicker">${tr("vocabulary.title", {}, "Vocabulary")}</p><h2 id="vocabulary-lookup-title">${tr("vocabulary.addEntry", {}, "Add a word or phrase")}</h2></div>
          <button type="button" aria-label="${tr("vocabulary.closeLookup", {}, "Close vocabulary lookup")}" data-vocab-close-lookup>×</button>
        </div>
        <form class="vocabulary-lookup-form" data-vocab-lookup-form>
          <label for="vocabulary-lookup-input">${tr("vocabulary.entryLabel", {}, "English or Vietnamese entry")}</label>
          <input id="vocabulary-lookup-input" name="query" type="text" maxlength="80" autocomplete="off" placeholder="${tr("vocabulary.entryPlaceholder", {}, "e.g. issue or vấn đề")}" required>
          <label class="vocabulary-context-field" for="vocabulary-context-input">
            <span>${tr("vocabulary.context", {}, "Context")} <small>${tr("vocabulary.contextOptional", {}, "optional · use this for the exact meaning")}</small></span>
            <input id="vocabulary-context-input" name="context" type="text" maxlength="240" autocomplete="off" placeholder="${tr("vocabulary.contextPlaceholder", {}, "e.g. The company issued a certificate.")}">
          </label>
          <button class="primary-button vocabulary-lookup-submit" type="submit">${tr("vocabulary.lookup", {}, "Look up")}</button>
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
          <div><p class="section-kicker">${tr("vocabulary.quickPractice", {}, "Quick practice")}</p><h2 id="vocabulary-mobile-title">${tr("vocabulary.title", {}, "Vocabulary")}</h2></div>
          <button type="button" aria-label="${tr("vocabulary.closePractice", {}, "Close vocabulary practice")}" data-vocab-close-practice>×</button>
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
    button.innerHTML = `<small>${tr("vocabulary.words", {}, "Words")}</small>`;
    button.setAttribute("aria-label", tr("vocabulary.openPractice", {}, "Open vocabulary practice"));
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
      inputLanguage: word.inputLanguage === "vi" ? "vi" : "en",
      english,
      partOfSpeech: cleanText(word.partOfSpeech || word.part_of_speech),
      vietnamese,
      ipa: cleanText(word.ipa),
      pronunciationVi: cleanText(word.pronunciationVi || word.pronunciation_vi),
      example: cleanText(word.example),
      exampleVietnamese: cleanText(word.exampleVietnamese || word.example_vietnamese),
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
      // Keep the last local cache so flashcards remain usable during a temporary outage.
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
        <div class="vocabulary-widget-heading"><div><strong>${tr("vocabulary.title", {}, "Vocabulary")}</strong><small>${tr("vocabulary.loadingSaved", {}, "Loading saved words…")}</small></div></div>
        <div class="vocabulary-empty"><span aria-hidden="true">Aa</span><p>${tr("vocabulary.preparing", {}, "Preparing your flashcards.")}</p></div>
      `;
    }

    if (!count) {
      return `
        <div class="vocabulary-widget-heading">
          <div><strong>${tr("vocabulary.title", {}, "Vocabulary")}</strong><small>${tr("vocabulary.noSaved", {}, "No saved words")}</small></div>
          <button type="button" data-vocab-open-lookup>${tr("vocabulary.add", {}, "+ Add")}</button>
        </div>
        <div class="vocabulary-empty">
          <span aria-hidden="true">Aa</span>
          <p>${tr("vocabulary.addFirstHelp", {}, "Add your first word to start practicing.")}</p>
          <button type="button" data-vocab-open-lookup>${tr("vocabulary.addWord", {}, "+ Add word")}</button>
        </div>
      `;
    }

    const word = currentWord();
    if (!word) return "";
    const prompt = state.direction === "vi-en" ? word.vietnamese : word.english;
    const target = state.direction === "vi-en" ? "English" : "Vietnamese";
    const savedCount = tr(count === 1 ? "vocabulary.savedCountOne" : "vocabulary.savedCountMany", { count }, `${count} saved ${count === 1 ? "word" : "words"}`);
    const direction = translateUi(`Translate into ${target}`);

    return `
      <div class="vocabulary-widget-heading">
        <div><strong>${tr("vocabulary.title", {}, "Vocabulary")}</strong><small>${savedCount}</small></div>
        <button type="button" data-vocab-open-lookup>${tr("vocabulary.add", {}, "+ Add")}</button>
      </div>
      <div class="vocabulary-practice">
        <small class="vocabulary-direction">${direction}</small>
        <strong class="vocabulary-prompt" data-i18n-skip>${escapeHtml(prompt)}</strong>
        <form class="vocabulary-answer-form" data-vocab-practice-form>
          <input name="answer" type="text" autocomplete="off" placeholder="${tr("vocabulary.answerPlaceholder", {}, "Your answer…")}" aria-label="${tr("vocabulary.answerAria", {}, "Vocabulary answer")}" required>
          <button type="submit">${tr("vocabulary.check", {}, "Check")}</button>
        </form>
        <p class="vocabulary-feedback" data-vocab-feedback aria-live="polite"></p>
        <div class="vocabulary-practice-actions">
          <button type="button" data-vocab-show-answer>${tr("vocabulary.showAnswer", {}, "Show answer")}</button>
          <button type="button" data-vocab-next>${tr("vocabulary.next", {}, "Next →")}</button>
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
    feedback.textContent = correct ? tr("vocabulary.correct", {}, "Correct ✓") : tr("common.tryAgain", {}, "Try again");
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
    feedback.textContent = tr("vocabulary.answerValue", { value: expected }, `Answer: ${expected}`);
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
      // Review statistics should never block practice.
    }
  }

  function openLookupModal() {
    mobilePracticeModal.hidden = true;
    state.lookupResult = null;
    renderLookupResult();
    lookupModal.querySelector("[data-vocab-lookup-status]").textContent = "";
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
    const context = cleanText(form.elements.context.value);
    if (!query) return;

    state.lookupBusy = true;
    state.lookupResult = null;
    renderLookupResult();
    const status = lookupModal.querySelector("[data-vocab-lookup-status]");
    const button = form.querySelector('button[type="submit"]');
    status.textContent = tr("vocabulary.checkingCache", {}, "Joy is checking saved and cached results…");
    button.disabled = true;

    try {
      const payload = await requestJson(`${API_ROOT}/lookup`, {
        method: "POST",
        body: JSON.stringify({ query, context }),
      });
      state.lookupResult = normalizeWord(payload.word);
      if (!state.lookupResult) throw new Error("INVALID_VOCABULARY_RESULT");
      status.textContent = lookupStatus(payload);
      renderLookupResult();
    } catch (error) {
      status.textContent = vocabularyErrorMessage(error.code || error.message);
    } finally {
      state.lookupBusy = false;
      button.disabled = false;
    }
  }

  function lookupStatus(payload) {
    if (payload.cached && payload.provider === "saved") return tr("vocabulary.alreadySavedNoAi", {}, "Already saved — no AI call used.");
    if (payload.cached) return tr("vocabulary.reusedNoAi", {}, "Reused a previous result — no new AI call used.");
    if (payload.provider === "openai") return tr("vocabulary.gptResult", {}, "GPT found a concise dictionary result.");
    return tr("vocabulary.fallbackResult", {}, "Fallback result found.");
  }

  function renderLookupResult() {
    const container = lookupModal.querySelector("[data-vocab-lookup-result]");
    const word = state.lookupResult;
    if (!container) return;
    if (!word) {
      container.innerHTML = "";
      return;
    }

    const englishMeta = word.partOfSpeech
      ? `${tr("vocabulary.englishLabel", {}, "English")} · ${escapeHtml(word.partOfSpeech)}`
      : tr("vocabulary.englishLabel", {}, "English");

    container.innerHTML = `
      <article class="vocabulary-result-card">
        <div class="vocabulary-result-main">
          <div>
            <small>${englishMeta}</small>
            <strong data-i18n-skip>${escapeHtml(word.english)}</strong>
          </div>
          <button type="button" data-vocab-speak aria-label="${tr("vocabulary.hearEntry", {}, "Hear the English entry")}">🔊</button>
        </div>
        <dl>
          <div><dt>${tr("vocabulary.vietnameseLabel", {}, "Vietnamese")}</dt><dd data-i18n-skip>${renderMeanings(word.vietnamese)}</dd></div>
          <div><dt>IPA</dt><dd data-i18n-skip>${escapeHtml(word.ipa || "—")}</dd></div>
          <div><dt>${tr("vocabulary.vietnameseReading", {}, "Vietnamese reading")}</dt><dd data-i18n-skip>${escapeHtml(word.pronunciationVi || "—")}</dd></div>
          <div class="vocabulary-example">
            <dt>${tr("vocabulary.example", {}, "Example")}</dt>
            <dd data-i18n-skip><span>${escapeHtml(word.example || "—")}</span>${word.exampleVietnamese ? `<small>${escapeHtml(word.exampleVietnamese)}</small>` : ""}</dd>
          </div>
        </dl>
        <p>${tr("vocabulary.saveQuestion", {}, "Save this entry?")}</p>
        <div class="modal-actions vocabulary-save-actions">
          <button class="secondary-button" type="button" data-vocab-no-save>${tr("common.no", {}, "No")}</button>
          <button class="primary-button" type="button" data-vocab-save ${state.saveBusy ? "disabled" : ""}>${tr("common.yes", {}, "Yes")}</button>
        </div>
      </article>
    `;
  }

  function renderMeanings(value) {
    return cleanText(value)
      .split(/\s*;\s*/)
      .filter(Boolean)
      .slice(0, 2)
      .map((meaning, index) => `<span class="vocabulary-meaning">${index + 1}. ${escapeHtml(meaning)}</span>`)
      .join("");
  }

  async function saveLookupResult() {
    if (!state.lookupResult || state.saveBusy) return;
    state.saveBusy = true;
    renderLookupResult();
    const status = lookupModal.querySelector("[data-vocab-lookup-status]");
    status.textContent = tr("common.saving", {}, "Saving…");

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
      status.textContent = payload.created === false
        ? tr("vocabulary.alreadySaved", {}, "This entry was already saved.")
        : tr("vocabulary.saved", {}, "Saved.");
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
    if (code === "INVALID_VOCABULARY_INPUT") return tr("vocabulary.invalidInput", {}, "Enter one English or Vietnamese word or short phrase.");
    if (code === "INVALID_VOCABULARY_CONTEXT") return tr("vocabulary.invalidContext", {}, "Keep the optional context to one short sentence.");
    if (code === "VOCABULARY_AI_UNAVAILABLE") return tr("vocabulary.unavailable", {}, "Vocabulary lookup is temporarily unavailable.");
    if (code === "VOCABULARY_RESULT_INVALID") return tr("vocabulary.invalidResult", {}, "Joy could not form a clear dictionary entry. Add a short context sentence.");
    if (code === "UNAUTHENTICATED") return tr("vocabulary.sessionExpired", {}, "Your Joy session expired. Refresh and sign in again.");
    return tr("vocabulary.requestFailed", {}, "Joy could not complete this vocabulary request.");
  }

  async function requestJson(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await window.fetch(path, { ...options, headers, credentials: "same-origin" });
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
    const alternatives = cleanText(expected).split(/\s*;\s*/).filter(Boolean).map(normalizeAnswer);
    if (alternatives.includes(normalizedActual)) return true;
    if (!allowVietnameseWithoutMarks) return false;
    const unmarked = removeVietnameseMarks(normalizedActual);
    return alternatives.some((candidate) => removeVietnameseMarks(candidate) === unmarked);
  }

  function normalizeAnswer(value) {
    return cleanText(value)
      .toLocaleLowerCase("vi")
      .replace(/[.!?,]+$/g, "")
      .replace(/\s+/g, " ");
  }

  function removeVietnameseMarks(value) {
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
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

  function syncLocaleUi() {
    scratchpad.setAttribute("aria-label", tr("vocabulary.flashcardsAria", {}, "Vocabulary flashcards"));
    renderPracticeRoots();
    renderLookupResult();
    i18n()?.translateRoot?.(lookupModal);
    i18n()?.translateRoot?.(mobilePracticeModal);
    const mobileButton = document.querySelector("[data-vocab-open-practice]");
    if (mobileButton) {
      mobileButton.innerHTML = `<small>${tr("vocabulary.words", {}, "Words")}</small>`;
      mobileButton.setAttribute("aria-label", tr("vocabulary.openPractice", {}, "Open vocabulary practice"));
    }
  }

  window.addEventListener("joy:i18n-ready", syncLocaleUi);
  window.addEventListener("joy:locale-changed", syncLocaleUi);

  window.JoyVocabulary = Object.freeze({ normalizeAnswer, answersMatch });
})();
