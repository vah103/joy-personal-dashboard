(() => {
  const API_ROOT = "/api/vocabulary";
  const LOCAL_STORAGE_KEY = "joy-vocabulary-cache-v1";
  const vocabularyWidget = document.querySelector("[data-vocabulary-widget]");
  if (!vocabularyWidget) return;

  const state = {
    words: loadLocalWords(),
    loading: true,
    currentId: "",
    direction: "vi-en",
    reviewRecorded: false,
    nextTimer: null,
  };

  const mobilePracticeModal = createMobilePracticeModal();
  document.body.append(mobilePracticeModal);
  addMobileNavigationButton();

  document.addEventListener("submit", handleSubmit);
  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("joy:vocabulary-changed", handleVocabularyChanged);

  renderPracticeRoots();
  loadWords();

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

  function handleVocabularyChanged() {
    void loadWords();
  }

  function ensureCurrentWord() {
    if (!state.words.length) {
      state.currentId = "";
      return;
    }
    if (!state.words.some((word) => word.id === state.currentId)) pickNextWord();
  }

  function availableDirections(word) {
    const directions = ["vi-en", "en-vi"];
    if (word?.exampleVietnamese) directions.push("vi-example-en");
    if (word?.example) directions.push("en-example-vi");
    return directions;
  }

  function pickDirection(word) {
    const directions = availableDirections(word);
    return directions[Math.floor(Math.random() * directions.length)] || "vi-en";
  }

  function pickNextWord() {
    window.clearTimeout(state.nextTimer);
    const candidates = state.words.length > 1
      ? state.words.filter((word) => word.id !== state.currentId)
      : state.words;
    const next = candidates[Math.floor(Math.random() * candidates.length)] || state.words[0];
    state.currentId = next?.id || "";
    state.direction = pickDirection(next);
    state.reviewRecorded = false;
  }

  function currentWord() {
    return state.words.find((word) => word.id === state.currentId) || null;
  }

  function practiceConfig(word) {
    if (!word) return null;
    if (state.direction === "vi-example-en" && word.exampleVietnamese) {
      return {
        prompt: word.exampleVietnamese,
        expected: word.english,
        label: "Vietnamese example → English word",
        allowVietnameseWithoutMarks: false,
        isExample: true,
      };
    }
    if (state.direction === "en-example-vi" && word.example) {
      return {
        prompt: word.example,
        expected: word.vietnamese,
        label: "English example → Vietnamese word",
        allowVietnameseWithoutMarks: true,
        isExample: true,
      };
    }
    if (state.direction === "en-vi") {
      return {
        prompt: word.english,
        expected: word.vietnamese,
        label: "English word → Vietnamese word",
        allowVietnameseWithoutMarks: true,
        isExample: false,
      };
    }
    return {
      prompt: word.vietnamese,
      expected: word.english,
      label: "Vietnamese word → English word",
      allowVietnameseWithoutMarks: false,
      isExample: false,
    };
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
        <div class="vocabulary-widget-heading"><div><strong>Vocabulary</strong><small>No saved words</small></div></div>
        <div class="vocabulary-empty"><span aria-hidden="true">Aa</span><p>Add your first word to start practicing.</p></div>
      `;
    }

    const word = currentWord();
    const config = practiceConfig(word);
    if (!word || !config) return "";

    return `
      <div class="vocabulary-widget-heading">
        <div><strong>Vocabulary</strong><small>${count} saved ${count === 1 ? "word" : "words"}</small></div>
      </div>
      <div class="vocabulary-practice" data-vocab-practice-mode="${escapeHtml(state.direction)}">
        <small class="vocabulary-direction">${escapeHtml(config.label)}</small>
        <strong class="vocabulary-prompt${config.isExample ? " is-example" : ""}">${escapeHtml(config.prompt)}</strong>
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

  function handleSubmit(event) {
    const practiceForm = event.target.closest("[data-vocab-practice-form]");
    if (!practiceForm) return;
    event.preventDefault();
    checkAnswer(practiceForm);
  }

  function handleClick(event) {
    const control = event.target.closest("button, [data-vocab-action]");
    if (!control) return;
    if (control.matches("[data-vocab-open-practice]")) openPracticeModal();
    if (control.matches("[data-vocab-close-practice]")) closePracticeModal();
    if (control.matches("[data-vocab-show-answer]")) showAnswer(control);
    if (control.matches("[data-vocab-next]")) nextWord();
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && !mobilePracticeModal.hidden) closePracticeModal();
  }

  function checkAnswer(form) {
    const word = currentWord();
    const config = practiceConfig(word);
    if (!word || !config) return;
    const input = form.elements.answer;
    const feedback = form.parentElement.querySelector("[data-vocab-feedback]");
    const correct = answersMatch(input.value, config.expected, config.allowVietnameseWithoutMarks);
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
    const config = practiceConfig(word);
    if (!word || !config) return;
    const root = control.closest("[data-vocab-practice-root]");
    const feedback = root?.querySelector("[data-vocab-feedback]");
    if (!feedback) return;
    feedback.className = "vocabulary-feedback is-answer";
    feedback.textContent = `Answer: ${config.expected}`;
  }

  function nextWord() {
    if (!state.words.length) return;
    pickNextWord();
    renderPracticeRoots();
    window.setTimeout(() => {
      const visibleRoot = !mobilePracticeModal.hidden
        ? mobilePracticeModal.querySelector("[data-vocab-practice-root]")
        : vocabularyWidget.querySelector("[data-vocab-practice-root]");
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
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.JoyVocabulary = Object.freeze({ normalizeAnswer, answersMatch, reload: loadWords });
})();
