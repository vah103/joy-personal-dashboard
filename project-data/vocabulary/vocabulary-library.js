(() => {
  const API_ROOT = "/api/vocabulary";
  const LOCAL_STORAGE_KEY = "joy-vocabulary-cache-v1";

  let words = [];
  let loading = false;
  let saving = false;
  let adding = false;
  let dirty = false;

  const modal = createLibraryModal();
  document.body.append(modal);

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);

  function createLibraryModal() {
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
          </div>
          <div class="vocabulary-library-heading-actions">
            <button class="secondary-button" type="button" data-vocab-library-add>+ Add manually</button>
            <button type="button" aria-label="Close vocabulary library" data-vocab-library-close>×</button>
          </div>
        </div>
        <p class="vocabulary-library-status" data-vocab-library-status aria-live="polite"></p>
        <div class="vocabulary-library-table-wrap">
          <table class="vocabulary-library-table">
            <thead>
              <tr>
                <th scope="col">English</th>
                <th scope="col">IPA</th>
                <th scope="col">Vietnamese reading</th>
                <th scope="col">Vietnamese meaning</th>
                <th scope="col">English example</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody data-vocab-library-body></tbody>
          </table>
        </div>
      </section>
    `;
    element.addEventListener("mousedown", (event) => {
      if (event.target === element) closeLibrary();
    });
    return element;
  }

  async function handleClick(event) {
    const close = event.target.closest("[data-vocab-library-close]");
    if (close) {
      closeLibrary();
      return;
    }

    const add = event.target.closest("[data-vocab-library-add]");
    if (add) {
      adding = true;
      renderRows();
      focusNewRow();
      return;
    }

    const cancel = event.target.closest("[data-vocab-library-cancel-new]");
    if (cancel) {
      adding = false;
      renderRows();
      setStatus("");
      return;
    }

    const save = event.target.closest("[data-vocab-library-save-row]");
    if (save) {
      await saveRow(save.closest("tr"));
      return;
    }

    const topLine = event.target.closest(".vocabulary-compact-topline");
    if (!topLine || event.target.closest("button")) return;
    event.preventDefault();
    await openLibrary();
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && !modal.hidden) {
      closeLibrary();
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && event.target.matches(".vocabulary-compact-topline")) {
      event.preventDefault();
      openLibrary();
    }
  }

  async function openLibrary() {
    if (loading) return;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    adding = false;
    setStatus("Loading saved words…");
    renderRows();
    await loadWords();
  }

  function closeLibrary() {
    modal.hidden = true;
    adding = false;
    releaseModalLock();
    if (dirty) window.location.reload();
  }

  function releaseModalLock() {
    if (![...document.querySelectorAll(".modal-backdrop")].some((item) => !item.hidden)) {
      document.body.classList.remove("modal-open");
    }
  }

  async function loadWords() {
    loading = true;
    try {
      const payload = await requestJson(API_ROOT);
      words = Array.isArray(payload.words) ? payload.words.map(normalizeWord).filter(Boolean) : [];
      saveLocalWords();
      setStatus(`${words.length} saved ${words.length === 1 ? "word" : "words"}. Edit any cell and press Save.`);
    } catch (error) {
      words = loadLocalWords();
      setStatus(errorMessage(error.code || error.message));
    } finally {
      loading = false;
      renderRows();
    }
  }

  function renderRows() {
    const body = modal.querySelector("[data-vocab-library-body]");
    if (!body) return;

    const rows = [];
    if (adding) rows.push(rowMarkup(null, true));
    rows.push(...words.map((word) => rowMarkup(word, false)));

    if (!rows.length && !loading) {
      body.innerHTML = `
        <tr class="vocabulary-library-empty-row">
          <td colspan="6">No saved words yet. Use “+ Add manually” or look up a word from the Vocabulary card.</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = rows.join("");
  }

  function rowMarkup(word, isNew) {
    const item = word || {
      id: "",
      english: "",
      ipa: "",
      pronunciationVi: "",
      vietnamese: "",
      example: "",
    };

    return `
      <tr data-vocab-library-row data-word-id="${escapeHtml(item.id)}" class="${isNew ? "is-new" : ""}">
        <td><input data-vocab-field="english" type="text" maxlength="80" value="${escapeHtml(item.english)}" placeholder="institution" aria-label="English word" required></td>
        <td><input data-vocab-field="ipa" type="text" maxlength="100" value="${escapeHtml(item.ipa)}" placeholder="/ˌɪnstɪˈtuːʃən/" aria-label="IPA" required></td>
        <td><input data-vocab-field="pronunciationVi" type="text" maxlength="100" value="${escapeHtml(item.pronunciationVi)}" placeholder="in-sti-tu-shần" aria-label="Vietnamese pronunciation" required></td>
        <td><textarea data-vocab-field="vietnamese" maxlength="240" rows="2" placeholder="tổ chức; cơ quan" aria-label="Vietnamese meaning" required>${escapeHtml(item.vietnamese)}</textarea></td>
        <td><textarea data-vocab-field="example" maxlength="260" rows="2" placeholder="The institution was founded in 1900." aria-label="English example" required>${escapeHtml(item.example)}</textarea></td>
        <td class="vocabulary-library-row-actions">
          <button class="primary-button" type="button" data-vocab-library-save-row ${saving ? "disabled" : ""}>Save</button>
          ${isNew ? '<button class="secondary-button" type="button" data-vocab-library-cancel-new>Cancel</button>' : ""}
        </td>
      </tr>
    `;
  }

  async function saveRow(row) {
    if (!row || saving) return;
    const id = cleanText(row.dataset.wordId);
    const existing = id ? words.find((word) => word.id === id) : null;
    const word = {
      english: fieldValue(row, "english").toLowerCase(),
      ipa: fieldValue(row, "ipa"),
      pronunciationVi: fieldValue(row, "pronunciationVi"),
      vietnamese: fieldValue(row, "vietnamese"),
      example: fieldValue(row, "example"),
      exampleVietnamese: existing?.exampleVietnamese || "",
      partOfSpeech: existing?.partOfSpeech || "",
      inputLanguage: "en",
    };

    if (!word.english || !word.ipa || !word.pronunciationVi || !word.vietnamese || !word.example) {
      setStatus("Fill in all five vocabulary columns before saving.");
      return;
    }

    if (id) {
      word.id = id;
      word.operation = "update";
    }

    saving = true;
    renderRows();
    setStatus(id ? "Saving changes…" : "Adding word…");

    try {
      const payload = await requestJson(API_ROOT, {
        method: "POST",
        body: JSON.stringify(word),
      });
      const saved = normalizeWord(payload.word);
      if (!saved) throw new Error("VOCABULARY_SAVE_FAILED");

      const index = words.findIndex((item) => item.id === saved.id || item.english === saved.english);
      if (index >= 0) words.splice(index, 1, saved);
      else words.unshift(saved);

      adding = false;
      dirty = true;
      saveLocalWords();
      updateVisibleCounts();
      setStatus(payload.updated ? "Changes saved." : payload.created === false ? "This word was already saved." : "Word added.");
    } catch (error) {
      setStatus(errorMessage(error.code || error.message));
    } finally {
      saving = false;
      renderRows();
    }
  }

  function fieldValue(row, name) {
    return cleanText(row.querySelector(`[data-vocab-field="${name}"]`)?.value);
  }

  function focusNewRow() {
    window.setTimeout(() => {
      modal.querySelector('tr.is-new [data-vocab-field="english"]')?.focus();
    }, 0);
  }

  function updateVisibleCounts() {
    document.querySelectorAll(".vocabulary-compact-title span").forEach((count) => {
      count.textContent = String(words.length);
      count.setAttribute("aria-label", `${words.length} saved words`);
    });
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
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(words));
    } catch {
      // D1 remains authoritative when local storage is unavailable.
    }
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
      reviewCount: Number(word.reviewCount || word.review_count || 0),
      correctCount: Number(word.correctCount || word.correct_count || 0),
      createdAt: Number(word.createdAt || word.created_at || Date.now()),
      updatedAt: Number(word.updatedAt || word.updated_at || Date.now()),
    };
  }

  function setStatus(message) {
    const status = modal.querySelector("[data-vocab-library-status]");
    if (status) status.textContent = message;
  }

  function errorMessage(code) {
    if (code === "VOCABULARY_WORD_EXISTS") return "Another saved row already uses that English word or phrase.";
    if (code === "VOCABULARY_WORD_NOT_FOUND") return "That saved word no longer exists. Reopen the library to refresh it.";
    if (code === "VOCABULARY_RESULT_INVALID") return "Check the English word, IPA, Vietnamese reading, meaning, and example sentence.";
    if (code === "UNAUTHENTICATED") return "Your Joy session expired. Refresh and sign in again.";
    return "Joy could not save this vocabulary row.";
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