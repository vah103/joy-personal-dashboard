(() => {
  const API_ROOT = "/api/vocabulary";
  const LOCAL_STORAGE_KEY = "joy-vocabulary-cache-v1";

  let words = [];
  let loading = false;
  let adding = false;
  let dirty = false;
  let editingCell = null;
  let deletingId = "";

  const modal = createLibraryModal();
  document.body.append(modal);

  document.addEventListener("click", handleClick);
  document.addEventListener("dblclick", handleDoubleClick);
  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("change", handleFieldChange);
  document.addEventListener("focusout", handleFieldBlur);
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

  function handleMouseDown(event) {
    if (event.target.closest("[data-vocab-library-delete]")) {
      event.preventDefault();
    }
  }

  async function handleClick(event) {
    const close = event.target.closest("[data-vocab-library-close]");
    if (close) {
      closeLibrary();
      return;
    }

    const remove = event.target.closest("[data-vocab-library-delete]");
    if (remove) {
      event.preventDefault();
      const row = remove.closest("[data-vocab-library-row]");
      await deleteWord(row);
      return;
    }

    const add = event.target.closest("[data-vocab-library-add]");
    if (add) {
      editingCell = null;
      if (!adding) {
        adding = true;
        renderRows();
      }
      focusNewRow();
      return;
    }

    const topLine = event.target.closest(".vocabulary-compact-topline");
    if (!topLine || event.target.closest("button")) return;
    event.preventDefault();
    await openLibrary();
  }

  function handleDoubleClick(event) {
    const display = event.target.closest("[data-vocab-display-field]");
    if (!display || modal.hidden) return;
    const row = display.closest("[data-vocab-library-row]");
    const id = cleanText(row?.dataset.wordId);
    const field = cleanText(display.dataset.vocabDisplayField);
    if (!row || !id || !field) return;

    editingCell = { id, field };
    renderRows();
    focusEditingCell(id, field);
  }

  async function handleFieldChange(event) {
    const field = event.target.closest("[data-vocab-field]");
    if (!field || modal.hidden) return;
    const row = field.closest("[data-vocab-library-row]");
    if (!row || !row.classList.contains("is-new")) return;
    await saveRow(row);
  }

  async function handleFieldBlur(event) {
    const field = event.target.closest("[data-vocab-field]");
    if (!field || modal.hidden) return;
    const row = field.closest("[data-vocab-library-row]");
    if (!row || row.classList.contains("is-new")) return;

    const id = cleanText(row.dataset.wordId);
    const fieldName = cleanText(field.dataset.vocabField);
    if (!editingCell || editingCell.id !== id || editingCell.field !== fieldName) return;

    const saved = await saveRow(row);
    if (!saved) return;
    if (editingCell?.id === id && editingCell?.field === fieldName) {
      editingCell = null;
      renderRows();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && editingCell && !modal.hidden) {
      event.preventDefault();
      editingCell = null;
      renderRows();
      return;
    }

    if (event.key === "Escape" && !modal.hidden) {
      closeLibrary();
      return;
    }

    if (event.key === "Enter" && event.target.matches('input[data-vocab-field]') && !event.target.closest("tr.is-new")) {
      event.preventDefault();
      event.target.blur();
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
    editingCell = null;
    deletingId = "";
    setStatus("Loading saved words…");
    renderRows();
    await loadWords();
  }

  function closeLibrary() {
    modal.hidden = true;
    adding = false;
    editingCell = null;
    deletingId = "";
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
      setStatus(`${words.length} saved ${words.length === 1 ? "word" : "words"}. Double-click a cell to edit; the active row also shows delete. Changes save automatically.`);
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
          <td colspan="5">No saved words yet. Use “+ Add manually” or look up a word from the Vocabulary card.</td>
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

    const editingEnglish = isNew || isEditing(item.id, "english");
    const editingIpa = isNew || isEditing(item.id, "ipa");
    const editingPronunciation = isNew || isEditing(item.id, "pronunciationVi");
    const editingVietnamese = isNew || isEditing(item.id, "vietnamese");
    const editingExample = isNew || isEditing(item.id, "example");
    const editingRow = !isNew && editingCell?.id === item.id;
    const deleting = Boolean(item.id && deletingId === item.id);
    const rowClasses = [
      isNew ? "is-new" : "",
      editingRow ? "is-editing-row" : "",
      deleting ? "is-deleting" : "",
    ].filter(Boolean).join(" ");

    return `
      <tr data-vocab-library-row data-word-id="${escapeHtml(item.id)}" class="${rowClasses}">
        <td>${editingEnglish
          ? `<input data-vocab-field="english" type="text" maxlength="80" value="${escapeHtml(item.english)}" placeholder="institution" aria-label="English word" required>`
          : displayMarkup("english", item.english, "English word")}</td>
        <td>${editingIpa
          ? `<input data-vocab-field="ipa" type="text" maxlength="100" value="${escapeHtml(item.ipa)}" placeholder="/ˌɪnstɪˈtuːʃən/" aria-label="IPA" required>`
          : displayMarkup("ipa", item.ipa, "IPA")}</td>
        <td>${editingPronunciation
          ? `<input data-vocab-field="pronunciationVi" type="text" maxlength="100" value="${escapeHtml(item.pronunciationVi)}" placeholder="in-sti-tu-shần" aria-label="Vietnamese pronunciation" required>`
          : displayMarkup("pronunciationVi", item.pronunciationVi, "Vietnamese pronunciation")}</td>
        <td>${editingVietnamese
          ? `<textarea data-vocab-field="vietnamese" maxlength="240" rows="2" placeholder="tổ chức; cơ quan" aria-label="Vietnamese meaning" required>${escapeHtml(item.vietnamese)}</textarea>`
          : displayMarkup("vietnamese", item.vietnamese, "Vietnamese meaning", true)}</td>
        <td class="vocabulary-library-example-cell">${editingExample
          ? `<textarea data-vocab-field="example" maxlength="260" rows="2" placeholder="The institution was founded in 1900." aria-label="English example" required>${escapeHtml(item.example)}</textarea>`
          : displayMarkup("example", item.example, "English example", true)}
          ${editingRow ? deleteButtonMarkup(item, deleting) : ""}
        </td>
      </tr>
    `;
  }

  function deleteButtonMarkup(item, deleting) {
    const label = `Delete ${item.english || "saved word"}`;
    return `
      <button class="vocabulary-library-delete" type="button" data-vocab-library-delete aria-label="${escapeHtml(label)}" title="Delete saved word" ${deleting ? "disabled" : ""}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/>
        </svg>
      </button>
    `;
  }

  function displayMarkup(field, value, label, multiline = false) {
    const display = escapeHtml(value) || "—";
    return `<div class="vocabulary-library-value${multiline ? " is-multiline" : ""}" data-vocab-display-field="${field}" aria-label="${escapeHtml(label)}. Double-click to edit." title="Double-click to edit">${display}</div>`;
  }

  function isEditing(id, field) {
    return Boolean(id && editingCell?.id === id && editingCell?.field === field);
  }

  function focusEditingCell(id, field) {
    window.setTimeout(() => {
      const row = [...modal.querySelectorAll("[data-vocab-library-row]")]
        .find((candidate) => candidate.dataset.wordId === id);
      const editor = row?.querySelector(`[data-vocab-field="${field}"]`);
      editor?.focus();
      if (editor?.select) editor.select();
    }, 0);
  }

  async function deleteWord(row) {
    const id = cleanText(row?.dataset.wordId);
    if (!row || !id || deletingId) return;
    const word = words.find((item) => item.id === id);
    const english = cleanText(word?.english) || "this word";
    if (!window.confirm(`Delete “${english}” from Saved Words?`)) return;

    deletingId = id;
    row.classList.add("is-deleting");
    row.querySelector("[data-vocab-library-delete]")?.setAttribute("disabled", "");
    setStatus(`Deleting “${english}”…`);

    try {
      await requestJson(API_ROOT, {
        method: "POST",
        body: JSON.stringify({ operation: "delete", id }),
      });
      words = words.filter((item) => item.id !== id);
      editingCell = null;
      dirty = true;
      saveLocalWords();
      updateVisibleCounts();
      setStatus(`Deleted “${english}”.`);
      renderRows();
    } catch (error) {
      setStatus(errorMessage(error.code || error.message, "delete"));
    } finally {
      deletingId = "";
      if (row.isConnected) {
        row.classList.remove("is-deleting");
        row.querySelector("[data-vocab-library-delete]")?.removeAttribute("disabled");
      }
    }
  }

  async function saveRow(row) {
    if (!row) return null;

    if (row.dataset.saving === "true") {
      row.dataset.saveAgain = "true";
      return null;
    }

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
      if (!id) setStatus("Complete all five columns and Joy will add the word automatically.");
      return null;
    }

    if (id) {
      word.id = id;
      word.operation = "update";
    }

    row.dataset.saving = "true";
    row.classList.add("is-saving");
    setStatus(id ? "Saving changes…" : "Adding word…");

    let saved = null;
    try {
      const payload = await requestJson(API_ROOT, {
        method: "POST",
        body: JSON.stringify(word),
      });
      saved = normalizeWord(payload.word);
      if (!saved) throw new Error("VOCABULARY_SAVE_FAILED");

      const index = words.findIndex((item) => item.id === saved.id || item.english === saved.english);
      if (index >= 0) words.splice(index, 1, saved);
      else words.unshift(saved);

      dirty = true;
      saveLocalWords();
      updateVisibleCounts();

      if (!id) {
        adding = false;
        renderRows();
      } else {
        row.dataset.wordId = saved.id;
        row.classList.remove("is-new");
      }

      setStatus(payload.updated ? "Changes saved automatically." : payload.created === false ? "This word was already saved." : "Word added automatically.");
    } catch (error) {
      saved = null;
      setStatus(errorMessage(error.code || error.message));
    } finally {
      if (row.isConnected) {
        row.dataset.saving = "false";
        row.classList.remove("is-saving");
        if (row.dataset.saveAgain === "true") {
          row.dataset.saveAgain = "false";
          saveRow(row);
        }
      }
    }
    return saved;
  }

  function fieldValue(row, name) {
    const editor = row.querySelector(`[data-vocab-field="${name}"]`);
    if (editor) return cleanText(editor.value);
    return cleanText(row.querySelector(`[data-vocab-display-field="${name}"]`)?.textContent);
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

  function errorMessage(code, action = "save") {
    if (code === "VOCABULARY_WORD_EXISTS") return "Another saved row already uses that English word or phrase.";
    if (code === "VOCABULARY_WORD_NOT_FOUND") return "That saved word no longer exists. Reopen the library to refresh it.";
    if (code === "VOCABULARY_RESULT_INVALID") return "Check the English word, IPA, Vietnamese reading, meaning, and example sentence.";
    if (code === "UNAUTHENTICATED") return "Your Joy session expired. Refresh and sign in again.";
    return action === "delete" ? "Joy could not delete this vocabulary word." : "Joy could not save this vocabulary row.";
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