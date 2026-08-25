(() => {
  const VOCABULARY_API = "/api/vocabulary";
  const SPEAKING_API = "/api/speaking/english";
  const modal = document.querySelector("[data-vocab-library-modal]");
  if (!modal) return;

  const dialog = modal.querySelector(".vocabulary-library-modal");
  const headingActions = modal.querySelector(".vocabulary-library-heading-actions");
  const status = modal.querySelector("[data-vocab-library-status]");
  if (!dialog || !headingActions || !status) return;

  const state = {
    activeTool: "",
    lookupBusy: false,
    lookupSaveBusy: false,
    lookupResult: null,
    speakingBusy: false,
    speakingSentence: "",
    speakingTone: "natural",
  };

  installToolButtons();
  const tools = createToolsPanel();
  dialog.insertBefore(tools, status);

  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("keydown", handleKeydown);

  function installToolButtons() {
    if (headingActions.querySelector("[data-vocab-library-tool]")) return;
    const manual = headingActions.querySelector("[data-vocab-library-add]");
    const lookup = toolButton("lookup", "Look up", "Look up an English or Vietnamese word");
    const speaking = toolButton("say", "Say it", "Turn a Vietnamese sentence into natural English");
    headingActions.insertBefore(lookup, manual || headingActions.firstChild);
    headingActions.insertBefore(speaking, manual || headingActions.firstChild);
  }

  function toolButton(tool, label, ariaLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button vocabulary-library-tool-button";
    button.dataset.vocabLibraryTool = tool;
    button.setAttribute("aria-label", ariaLabel);
    button.setAttribute("aria-expanded", "false");
    button.textContent = label;
    return button;
  }

  function createToolsPanel() {
    const panel = document.createElement("section");
    panel.className = "vocabulary-library-tools";
    panel.dataset.vocabLibraryTools = "true";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="vocabulary-library-tool-panel" data-vocab-library-lookup-panel hidden>
        <form class="vocabulary-library-tool-form" data-vocab-library-lookup-form>
          <div class="vocabulary-library-tool-heading">
            <div><small>Dictionary</small><strong>Look up a word or phrase</strong></div>
            <button type="button" data-vocab-library-tool-close aria-label="Close lookup tool">×</button>
          </div>
          <div class="vocabulary-library-lookup-fields">
            <label>
              <span>English or Vietnamese</span>
              <input name="query" type="text" maxlength="80" autocomplete="off" placeholder="e.g. issue or vấn đề" required>
            </label>
            <label>
              <span>Context <small>optional</small></span>
              <input name="context" type="text" maxlength="240" autocomplete="off" placeholder="e.g. The company issued a certificate.">
            </label>
            <button class="primary-button" type="submit">Look up</button>
          </div>
        </form>
        <p class="vocabulary-library-tool-status" data-vocab-library-lookup-status aria-live="polite"></p>
        <div data-vocab-library-lookup-result></div>
      </div>

      <div class="vocabulary-library-tool-panel" data-vocab-library-speaking-panel hidden>
        <form class="vocabulary-library-tool-form" data-vocab-library-speaking-form>
          <div class="vocabulary-library-tool-heading">
            <div><small>Speaking</small><strong>How do I say this?</strong></div>
            <button type="button" data-vocab-library-tool-close aria-label="Close Say it tool">×</button>
          </div>
          <div class="vocabulary-library-speaking-fields">
            <label class="vocabulary-library-speaking-text">
              <span>Vietnamese sentence</span>
              <textarea name="text" maxlength="500" rows="2" autocomplete="off" placeholder="e.g. Tôi có thể ngồi ở đây không?" required></textarea>
            </label>
            <label>
              <span>Tone</span>
              <select name="tone">
                <option value="natural">Natural</option>
                <option value="casual">Casual</option>
                <option value="polite">Polite</option>
                <option value="work">Work</option>
              </select>
            </label>
            <button class="primary-button" type="submit">Make it English</button>
          </div>
        </form>
        <p class="vocabulary-library-tool-status" data-vocab-library-speaking-status aria-live="polite"></p>
        <div data-vocab-library-speaking-result></div>
      </div>
    `;
    return panel;
  }

  async function handleClick(event) {
    const toolButton = event.target.closest("[data-vocab-library-tool]");
    if (toolButton && !modal.hidden) {
      event.preventDefault();
      toggleTool(toolButton.dataset.vocabLibraryTool);
      return;
    }

    if (event.target.closest("[data-vocab-library-tool-close]")) {
      event.preventDefault();
      closeTools();
      return;
    }

    if (event.target.closest("[data-vocab-library-close]")) {
      closeTools();
      return;
    }

    if (event.target.closest("[data-vocab-library-lookup-speak]")) {
      speakText(state.lookupResult?.english, "en-US");
      return;
    }

    if (event.target.closest("[data-vocab-library-lookup-clear]")) {
      state.lookupResult = null;
      renderLookupResult();
      setToolStatus("lookup", "");
      return;
    }

    if (event.target.closest("[data-vocab-library-lookup-save]")) {
      await saveLookupResult();
      return;
    }

    if (event.target.closest("[data-vocab-library-speaking-speak]")) {
      speakText(state.speakingSentence, "en-US");
      return;
    }

    if (event.target.closest("[data-vocab-library-speaking-copy]")) {
      await copySpeakingSentence();
      return;
    }

    if (event.target.closest("[data-vocab-library-speaking-clear]")) {
      state.speakingSentence = "";
      renderSpeakingResult();
      setToolStatus("say", "");
    }
  }

  async function handleSubmit(event) {
    const lookupForm = event.target.closest("[data-vocab-library-lookup-form]");
    if (lookupForm) {
      event.preventDefault();
      await lookupWord(lookupForm);
      return;
    }

    const speakingForm = event.target.closest("[data-vocab-library-speaking-form]");
    if (speakingForm) {
      event.preventDefault();
      await translateSentence(speakingForm);
    }
  }

  function handleKeydown(event) {
    if (event.key !== "Escape" || modal.hidden || !state.activeTool) return;
    event.preventDefault();
    event.stopPropagation();
    closeTools();
  }

  function toggleTool(tool) {
    if (!tool) return;
    if (state.activeTool === tool) {
      closeTools();
      return;
    }

    state.activeTool = tool;
    tools.hidden = false;
    tools.querySelector("[data-vocab-library-lookup-panel]").hidden = tool !== "lookup";
    tools.querySelector("[data-vocab-library-speaking-panel]").hidden = tool !== "say";
    headingActions.querySelectorAll("[data-vocab-library-tool]").forEach((button) => {
      const active = button.dataset.vocabLibraryTool === tool;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-expanded", String(active));
    });

    window.setTimeout(() => {
      if (tool === "lookup") tools.querySelector('[data-vocab-library-lookup-form] input[name="query"]')?.focus();
      else tools.querySelector('[data-vocab-library-speaking-form] textarea[name="text"]')?.focus();
    }, 0);
  }

  function closeTools() {
    state.activeTool = "";
    tools.hidden = true;
    tools.querySelectorAll(".vocabulary-library-tool-panel").forEach((panel) => { panel.hidden = true; });
    headingActions.querySelectorAll("[data-vocab-library-tool]").forEach((button) => {
      button.classList.remove("is-active");
      button.setAttribute("aria-expanded", "false");
    });
  }

  async function lookupWord(form) {
    if (state.lookupBusy) return;
    const query = cleanText(form.elements.query.value);
    const context = cleanText(form.elements.context.value);
    if (!query) return;

    state.lookupBusy = true;
    state.lookupResult = null;
    renderLookupResult();
    setToolStatus("lookup", "Joy is checking saved and cached results…");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;

    try {
      const payload = await requestJson(`${VOCABULARY_API}/lookup`, {
        method: "POST",
        body: JSON.stringify({ query, context }),
      });
      state.lookupResult = normalizeWord(payload.word);
      if (!state.lookupResult) throw new Error("VOCABULARY_RESULT_INVALID");
      setToolStatus("lookup", lookupStatus(payload));
      renderLookupResult();
    } catch (error) {
      setToolStatus("lookup", vocabularyErrorMessage(error.code || error.message));
    } finally {
      state.lookupBusy = false;
      submit.disabled = false;
    }
  }

  function lookupStatus(payload) {
    if (payload.cached && payload.provider === "saved") return "Already saved — no AI call used.";
    if (payload.cached) return "Reused a previous result — no new AI call used.";
    if (payload.provider === "openai") return "GPT found a concise dictionary result.";
    return "Fallback result found.";
  }

  function renderLookupResult() {
    const container = tools.querySelector("[data-vocab-library-lookup-result]");
    const word = state.lookupResult;
    if (!container) return;
    if (!word) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <article class="vocabulary-library-lookup-result">
        <div class="vocabulary-library-result-word">
          <div>
            <small>English${word.partOfSpeech ? ` · ${escapeHtml(word.partOfSpeech)}` : ""}</small>
            <strong>${escapeHtml(word.english)}</strong>
            <span>${escapeHtml(word.ipa || "—")} · ${escapeHtml(word.pronunciationVi || "—")}</span>
          </div>
          <button type="button" data-vocab-library-lookup-speak aria-label="Hear English pronunciation">🔊</button>
        </div>
        <div class="vocabulary-library-result-details">
          <p><small>Vietnamese</small><strong>${renderMeanings(word.vietnamese)}</strong></p>
          <p><small>Example</small><span>${escapeHtml(word.example || "—")}</span>${word.exampleVietnamese ? `<em>${escapeHtml(word.exampleVietnamese)}</em>` : ""}</p>
        </div>
        <div class="vocabulary-library-result-actions">
          <button class="secondary-button" type="button" data-vocab-library-lookup-clear>Clear</button>
          <button class="primary-button" type="button" data-vocab-library-lookup-save ${state.lookupSaveBusy ? "disabled" : ""}>Save to Words</button>
        </div>
      </article>
    `;
  }

  async function saveLookupResult() {
    if (!state.lookupResult || state.lookupSaveBusy) return;
    state.lookupSaveBusy = true;
    renderLookupResult();
    setToolStatus("lookup", "Saving…");

    try {
      const payload = await requestJson(VOCABULARY_API, {
        method: "POST",
        body: JSON.stringify(state.lookupResult),
      });
      setToolStatus("lookup", payload.created === false ? "This entry was already saved." : "Saved to Words.");
      window.setTimeout(refreshLibraryFromServer, 350);
    } catch (error) {
      setToolStatus("lookup", vocabularyErrorMessage(error.code || error.message));
    } finally {
      state.lookupSaveBusy = false;
      renderLookupResult();
    }
  }

  function refreshLibraryFromServer() {
    const close = modal.querySelector("[data-vocab-library-close]");
    const opener = document.querySelector(".vocabulary-compact-topline");
    if (!close || !opener) {
      window.location.reload();
      return;
    }
    close.click();
    window.setTimeout(() => opener.click(), 80);
  }

  async function translateSentence(form) {
    if (state.speakingBusy) return;
    const text = cleanText(form.elements.text.value);
    const tone = cleanText(form.elements.tone.value).toLowerCase() || "natural";
    if (!text) return;

    state.speakingBusy = true;
    state.speakingSentence = "";
    state.speakingTone = tone;
    renderSpeakingResult();
    setToolStatus("say", "Joy is finding one concise English sentence…");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;

    try {
      const payload = await requestJson(SPEAKING_API, {
        method: "POST",
        body: JSON.stringify({ text, tone }),
      });
      state.speakingSentence = cleanText(payload.sentence);
      state.speakingTone = cleanText(payload.tone) || tone;
      if (!state.speakingSentence) throw new Error("SPEAKING_RESULT_INVALID");
      setToolStatus("say", speakingStatus(payload));
      renderSpeakingResult();
    } catch (error) {
      setToolStatus("say", speakingErrorMessage(error.code || error.message));
    } finally {
      state.speakingBusy = false;
      submit.disabled = false;
    }
  }

  function speakingStatus(payload) {
    if (payload.cached) return "Reused a previous sentence — no new AI call used.";
    if (payload.provider === "openai") return "One GPT-generated English sentence.";
    return "One fallback English sentence.";
  }

  function renderSpeakingResult() {
    const container = tools.querySelector("[data-vocab-library-speaking-result]");
    if (!container) return;
    if (!state.speakingSentence) {
      container.innerHTML = "";
      return;
    }

    const tone = ({ natural: "Natural", casual: "Casual", polite: "Polite", work: "Work" })[state.speakingTone] || "Natural";
    container.innerHTML = `
      <article class="vocabulary-library-speaking-result">
        <small>${escapeHtml(tone)} English</small>
        <strong>${escapeHtml(state.speakingSentence)}</strong>
        <div class="vocabulary-library-result-actions">
          <button class="secondary-button" type="button" data-vocab-library-speaking-speak>🔊 Hear it</button>
          <button class="secondary-button" type="button" data-vocab-library-speaking-copy>Copy</button>
          <button class="secondary-button" type="button" data-vocab-library-speaking-clear>Clear</button>
        </div>
      </article>
    `;
  }

  async function copySpeakingSentence() {
    if (!state.speakingSentence) return;
    try {
      await navigator.clipboard.writeText(state.speakingSentence);
      setToolStatus("say", "Copied.");
    } catch {
      setToolStatus("say", "Could not copy automatically. Select the sentence and copy it manually.");
    }
  }

  function speakText(text, lang) {
    const sentence = cleanText(text);
    if (!sentence || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = lang;
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  function normalizeWord(word) {
    if (!word || typeof word !== "object") return null;
    const english = cleanText(word.english).toLowerCase();
    const vietnamese = cleanText(word.vietnamese);
    if (!english || !vietnamese) return null;
    return {
      id: cleanText(word.id),
      inputLanguage: word.inputLanguage === "vi" ? "vi" : "en",
      english,
      partOfSpeech: cleanText(word.partOfSpeech || word.part_of_speech),
      vietnamese,
      ipa: cleanText(word.ipa),
      pronunciationVi: cleanText(word.pronunciationVi || word.pronunciation_vi),
      example: cleanText(word.example),
      exampleVietnamese: cleanText(word.exampleVietnamese || word.example_vietnamese),
    };
  }

  function renderMeanings(value) {
    return cleanText(value)
      .split(/\s*;\s*/)
      .filter(Boolean)
      .slice(0, 2)
      .map((meaning, index) => `${index + 1}. ${escapeHtml(meaning)}`)
      .join(" · ");
  }

  function setToolStatus(tool, message) {
    const selector = tool === "lookup" ? "[data-vocab-library-lookup-status]" : "[data-vocab-library-speaking-status]";
    const element = tools.querySelector(selector);
    if (element) element.textContent = message;
  }

  function vocabularyErrorMessage(code) {
    if (code === "INVALID_VOCABULARY_INPUT") return "Enter one English or Vietnamese word or short phrase.";
    if (code === "INVALID_VOCABULARY_CONTEXT") return "Keep the optional context to one short sentence.";
    if (code === "VOCABULARY_AI_UNAVAILABLE") return "Vocabulary lookup is temporarily unavailable.";
    if (code === "VOCABULARY_RESULT_INVALID") return "Joy could not form a clear dictionary entry. Add a short context sentence.";
    if (code === "UNAUTHENTICATED") return "Your Joy session expired. Refresh and sign in again.";
    return "Joy could not complete this vocabulary request.";
  }

  function speakingErrorMessage(code) {
    if (code === "INVALID_SPEAKING_INPUT") return "Enter one Vietnamese sentence.";
    if (code === "SPEAKING_AI_UNAVAILABLE") return "Say it is temporarily unavailable.";
    if (code === "SPEAKING_RESULT_INVALID") return "Joy could not form a clear English sentence.";
    if (code === "UNAUTHENTICATED") return "Your Joy session expired. Refresh and sign in again.";
    return "Joy could not complete this speaking request.";
  }

  async function requestJson(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await window.fetch(path, { ...options, headers, credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Request failed with ${response.status}`);
      error.status = response.status;
      error.code = payload.error || "";
      throw error;
    }
    return payload;
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
})();
