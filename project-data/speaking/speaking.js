(() => {
  const API_PATH = "/api/speaking/english";
  const TONE_LABELS = Object.freeze({
    natural: "Natural",
    casual: "Casual",
    polite: "Polite",
    work: "Work",
  });
  const state = { sentence: "", tone: "natural", busy: false };

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
          <div><p class="section-kicker">Speaking</p><h2 id="speaking-title">How do I say this?</h2></div>
          <button type="button" aria-label="Close speaking tool" data-speaking-close>×</button>
        </div>
        <form class="speaking-form" data-speaking-form>
          <label for="speaking-vietnamese-input">Vietnamese sentence</label>
          <textarea id="speaking-vietnamese-input" name="text" maxlength="500" rows="4" autocomplete="off" placeholder="e.g. Tôi có thể ngồi ở đây không?" required></textarea>
          <div class="speaking-tone-row">
            <label for="speaking-tone">Tone</label>
            <select id="speaking-tone" name="tone">
              <option value="natural">Natural</option>
              <option value="casual">Casual</option>
              <option value="polite">Polite</option>
              <option value="work">Work</option>
            </select>
          </div>
          <button class="primary-button" type="submit">Make it English</button>
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
      if (actions.querySelector("[data-speaking-open]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "speaking-launch-button";
      button.dataset.speakingOpen = "true";
      button.textContent = "Say it";
      button.setAttribute("aria-label", "Turn a Vietnamese sentence into natural English");
      actions.prepend(button);
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
    status.textContent = "Joy is finding one concise English sentence…";
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
    if (payload.cached) return "Reused a previous sentence — no new AI call used.";
    if (payload.provider === "openai") return "One GPT-generated English sentence.";
    return "One fallback English sentence.";
  }

  function renderResult() {
    const container = modal.querySelector("[data-speaking-result]");
    if (!container) return;
    if (!state.sentence) {
      container.innerHTML = "";
      return;
    }
    const toneLabel = TONE_LABELS[state.tone] || TONE_LABELS.natural;
    container.innerHTML = `
      <article class="speaking-result-card">
        <small>${escapeHtml(toneLabel)} English</small>
        <p>${escapeHtml(state.sentence)}</p>
        <div class="speaking-result-actions">
          <button class="secondary-button" type="button" data-speaking-speak>🔊 Hear</button>
          <button class="secondary-button" type="button" data-speaking-copy>Copy</button>
          <button class="secondary-button" type="button" data-speaking-clear>Try another</button>
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
      status.textContent = "Copied.";
    } catch {
      status.textContent = "Could not copy automatically. Select the sentence and copy it manually.";
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
    if (code === "INVALID_SPEAKING_INPUT") return "Enter one Vietnamese sentence.";
    if (code === "INVALID_SPEAKING_TONE") return "Choose Natural, Casual, Polite, or Work.";
    if (code === "AI_DAILY_LIMIT_REACHED") return "The fallback AI daily limit has been reached. Try again after 7:00 AM.";
    if (code === "SPEAKING_AI_UNAVAILABLE") return "The speaking tool is temporarily unavailable.";
    if (code === "SPEAKING_RESULT_INVALID") return "Joy could not form one clear sentence. Try wording it more specifically.";
    if (code === "UNAUTHENTICATED") return "Your Joy session expired. Refresh and sign in again.";
    return "Joy could not translate this sentence right now.";
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
})();
