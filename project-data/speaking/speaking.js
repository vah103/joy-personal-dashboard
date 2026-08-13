(() => {
  const API_PATH = "/api/speaking/english";
  const TONE_KEYS = Object.freeze({
    natural: "speaking.natural",
    casual: "speaking.casual",
    polite: "speaking.polite",
    work: "speaking.work",
  });
  const state = { sentence: "", tone: "natural", busy: false };

  function i18n() {
    return window.JoyI18n || null;
  }

  function tr(key, values = {}, fallback = "") {
    const translated = i18n()?.t?.(key, values);
    return translated && translated !== key ? translated : fallback || key;
  }

  function toneLabel(tone) {
    const fallback = { natural: "Natural", casual: "Casual", polite: "Polite", work: "Work" }[tone] || "Natural";
    return tr(TONE_KEYS[tone] || TONE_KEYS.natural, {}, fallback);
  }

  const modal = createModal();
  document.body.append(modal);
  decorateVocabularyActions();
  observeVocabularyRenders();

  document.addEventListener("submit", handleSubmit);
  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);

  function createModal() {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop speaking-modal-backdrop";
    backdrop.dataset.speakingModal = "true";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="modal speaking-modal" role="dialog" aria-modal="true" aria-labelledby="speaking-title">
        <div class="modal-heading">
          <div><p class="section-kicker">${tr("speaking.kicker", {}, "Speaking")}</p><h2 id="speaking-title">${tr("speaking.title", {}, "How do I say this?")}</h2></div>
          <button type="button" aria-label="${tr("speaking.close", {}, "Close speaking tool")}" data-speaking-close>×</button>
        </div>
        <form class="speaking-form" data-speaking-form>
          <label for="speaking-vietnamese-input">${tr("speaking.inputLabel", {}, "Vietnamese sentence")}</label>
          <textarea id="speaking-vietnamese-input" name="text" maxlength="500" rows="4" autocomplete="off" placeholder="${tr("speaking.inputPlaceholder", {}, "e.g. Tôi có thể ngồi ở đây không?")}" required></textarea>
          <div class="speaking-tone-row">
            <label for="speaking-tone">${tr("speaking.tone", {}, "Tone")}</label>
            <select id="speaking-tone" name="tone">
              <option value="natural">${toneLabel("natural")}</option>
              <option value="casual">${toneLabel("casual")}</option>
              <option value="polite">${toneLabel("polite")}</option>
              <option value="work">${toneLabel("work")}</option>
            </select>
          </div>
          <button class="primary-button" type="submit">${tr("speaking.makeEnglish", {}, "Make it English")}</button>
        </form>
        <p class="speaking-status" data-speaking-status aria-live="polite"></p>
        <div data-speaking-result></div>
      </section>
    `;
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) closeModal();
    });
    return backdrop;
  }

  function observeVocabularyRenders() {
    const observer = new MutationObserver(decorateVocabularyActions);
    const desktopWidget = document.querySelector(".vocabulary-widget");
    const mobileWidget = document.querySelector(".vocabulary-mobile-modal");
    if (desktopWidget) observer.observe(desktopWidget, { childList: true, subtree: true });
    if (mobileWidget) observer.observe(mobileWidget, { childList: true, subtree: true });
  }

  function decorateVocabularyActions() {
    document.querySelectorAll(".vocabulary-widget-heading").forEach((heading) => {
      let actions = heading.querySelector(":scope > .vocabulary-widget-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "vocabulary-widget-actions";
        [...heading.querySelectorAll(":scope > button")].forEach((button) => actions.append(button));
        heading.append(actions);
      }
      let button = actions.querySelector("[data-speaking-open]");
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "speaking-launch-button";
        button.dataset.speakingOpen = "true";
        actions.prepend(button);
      }
      button.textContent = tr("speaking.sayIt", {}, "Say it");
      button.setAttribute("aria-label", tr("speaking.launchAria", {}, "Turn a Vietnamese sentence into natural English"));
    });
  }

  async function handleSubmit(event) {
    const form = event.target.closest("[data-speaking-form]");
    if (!form) return;
    event.preventDefault();
    await translateSentence(form);
  }

  async function handleClick(event) {
    const control = event.target.closest("button");
    if (!control) return;
    if (control.matches("[data-speaking-open]")) openModal();
    if (control.matches("[data-speaking-close]")) closeModal();
    if (control.matches("[data-speaking-speak]")) speakSentence();
    if (control.matches("[data-speaking-copy]")) await copySentence();
    if (control.matches("[data-speaking-clear]")) clearResult();
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && !modal.hidden) closeModal();
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && event.target.closest("[data-speaking-form]")) {
      event.preventDefault();
      event.target.closest("[data-speaking-form]")?.requestSubmit();
    }
  }

  function openModal() {
    state.sentence = "";
    state.tone = "natural";
    renderResult();
    modal.querySelector("[data-speaking-status]").textContent = "";
    modal.querySelector("[data-speaking-form]")?.reset();
    modal.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => modal.querySelector('textarea[name="text"]')?.focus(), 0);
  }

  function closeModal() {
    modal.hidden = true;
    state.sentence = "";
    state.busy = false;
    renderResult();
    releaseModalLock();
  }

  function releaseModalLock() {
    if (![...document.querySelectorAll(".modal-backdrop")].some((item) => !item.hidden)) {
      document.body.classList.remove("modal-open");
    }
  }

  async function translateSentence(form) {
    if (state.busy) return;
    const text = cleanText(form.elements.text.value);
    const tone = cleanText(form.elements.tone.value).toLowerCase() || "natural";
    if (!text) return;

    const status = modal.querySelector("[data-speaking-status]");
    const button = form.querySelector('button[type="submit"]');
    state.busy = true;
    state.sentence = "";
    state.tone = tone;
    renderResult();
    status.textContent = tr("speaking.finding", {}, "Joy is finding one concise English sentence…");
    button.disabled = true;

    try {
      const payload = await requestJson(API_PATH, {
        method: "POST",
        body: JSON.stringify({ text, tone }),
      });
      state.sentence = cleanText(payload.sentence);
      state.tone = cleanText(payload.tone) || tone;
      if (!state.sentence) throw new Error("SPEAKING_RESULT_INVALID");
      status.textContent = responseStatus(payload);
      renderResult();
    } catch (error) {
      status.textContent = speakingErrorMessage(error.code || error.message);
    } finally {
      state.busy = false;
      button.disabled = false;
    }
  }

  function responseStatus(payload) {
    if (payload.cached) return tr("speaking.cached", {}, "Reused a previous sentence — no new AI call used.");
    if (payload.provider === "openai") return tr("speaking.gpt", {}, "One GPT-generated English sentence.");
    return tr("speaking.fallback", {}, "One fallback English sentence.");
  }

  function renderResult() {
    const container = modal.querySelector("[data-speaking-result]");
    if (!container) return;
    if (!state.sentence) {
      container.innerHTML = "";
      return;
    }
    const label = tr("speaking.resultTone", { tone: toneLabel(state.tone) }, `${toneLabel(state.tone)} English`);
    container.innerHTML = `
      <article class="speaking-result-card">
        <small>${escapeHtml(label)}</small>
        <p data-i18n-skip>${escapeHtml(state.sentence)}</p>
        <div class="speaking-result-actions">
          <button class="secondary-button" type="button" data-speaking-speak>${tr("speaking.hear", {}, "🔊 Hear")}</button>
          <button class="secondary-button" type="button" data-speaking-copy>${tr("speaking.copy", {}, "Copy")}</button>
          <button class="secondary-button" type="button" data-speaking-clear>${tr("speaking.tryAnother", {}, "Try another")}</button>
        </div>
      </article>
    `;
  }

  function speakSentence() {
    if (!state.sentence || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.sentence);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  }

  async function copySentence() {
    if (!state.sentence) return;
    const status = modal.querySelector("[data-speaking-status]");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(state.sentence);
      } else {
        const helper = document.createElement("textarea");
        helper.value = state.sentence;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.append(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
      }
      status.textContent = tr("speaking.copied", {}, "Copied.");
    } catch {
      status.textContent = tr("speaking.copyFailed", {}, "Could not copy automatically. Select the sentence and copy it manually.");
    }
  }

  function clearResult() {
    state.sentence = "";
    renderResult();
    modal.querySelector("[data-speaking-status]").textContent = "";
    const textarea = modal.querySelector('textarea[name="text"]');
    if (textarea) {
      textarea.value = "";
      textarea.focus();
    }
  }

  function speakingErrorMessage(code) {
    if (code === "INVALID_SPEAKING_INPUT") return tr("speaking.invalidInput", {}, "Enter one Vietnamese sentence.");
    if (code === "INVALID_SPEAKING_TONE") return tr("speaking.invalidTone", {}, "Choose Natural, Casual, Polite, or Work.");
    if (code === "AI_DAILY_LIMIT_REACHED") return tr("speaking.dailyLimit", {}, "The fallback AI daily limit has been reached. Try again after 7:00 AM.");
    if (code === "SPEAKING_AI_UNAVAILABLE") return tr("speaking.unavailable", {}, "The speaking tool is temporarily unavailable.");
    if (code === "SPEAKING_RESULT_INVALID") return tr("speaking.invalidResult", {}, "Joy could not form one clear sentence. Try wording it more specifically.");
    if (code === "UNAUTHENTICATED") return tr("speaking.sessionExpired", {}, "Your Joy session expired. Refresh and sign in again.");
    return tr("speaking.requestFailed", {}, "Joy could not translate this sentence right now.");
  }

  async function requestJson(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await window.fetch(path, { ...options, headers, credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Speaking request failed with ${response.status}`);
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
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function syncLocaleUi() {
    decorateVocabularyActions();
    renderResult();
    i18n()?.translateRoot?.(modal);
  }

  window.addEventListener("joy:i18n-ready", syncLocaleUi);
  window.addEventListener("joy:locale-changed", syncLocaleUi);
})();
