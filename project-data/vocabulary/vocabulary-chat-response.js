(() => {
  if (window.__joyVocabularyChatResponseInstalled) return;
  window.__joyVocabularyChatResponseInstalled = true;

  const LOOKUP_PATH = "/api/vocabulary/lookup";
  const nativeFetch = window.fetch.bind(window);
  let latestAnswer = "";
  let latestAlreadySaved = false;
  let renderScheduled = false;

  window.fetch = async function joyVocabularyFetch(input, init = {}) {
    const requestUrl = typeof input === "string" || input instanceof URL ? String(input) : input?.url || "";
    const method = String(init.method || input?.method || "GET").toUpperCase();
    const isLookup = method === "POST" && pathnameFor(requestUrl) === LOOKUP_PATH;

    if (isLookup) {
      latestAnswer = "";
      latestAlreadySaved = false;
      removeChatResponse();
    }

    const response = await nativeFetch(input, init);
    if (!isLookup) return response;

    response.clone().json().then((payload) => {
      latestAnswer = normalizeAnswer(payload?.answerMarkdown || payload?.answer_markdown);
      latestAlreadySaved = payload?.alreadySaved === true;
      scheduleRender();
    }).catch(() => {
      latestAnswer = "";
      latestAlreadySaved = false;
    });

    return response;
  };

  function pathnameFor(value) {
    try {
      return new URL(value, window.location.origin).pathname;
    } catch {
      return "";
    }
  }

  function scheduleRender() {
    if (!latestAnswer || renderScheduled) return;
    renderScheduled = true;
    queueMicrotask(() => {
      renderScheduled = false;
      renderChatResponse();
    });
  }

  function renderChatResponse() {
    if (!latestAnswer) return;
    const container = document.querySelector("[data-vocab-lookup-result]");
    const flashcard = container?.querySelector(".vocabulary-result-card");
    if (!container || !flashcard) return;

    const renderKey = `${latestAlreadySaved ? "saved" : "new"}:${latestAnswer}`;
    let response = container.querySelector("[data-vocab-chat-response]");
    if (response?.dataset.renderKey === renderKey) return;

    if (!response) {
      response = document.createElement("section");
      response.className = "vocabulary-chat-response";
      response.dataset.vocabChatResponse = "true";
      response.setAttribute("aria-label", "ChatGPT vocabulary answer");
      container.insertBefore(response, flashcard);
    }

    response.dataset.renderKey = renderKey;
    response.innerHTML = `
      <div class="vocabulary-chat-response-heading">
        <span aria-hidden="true">✦</span>
        <div><small>ChatGPT answer</small><strong>Quick answer</strong></div>
      </div>
      <div class="vocabulary-chat-response-body">${renderMarkdown(latestAnswer)}</div>
    `;

    let label = container.querySelector("[data-vocab-flashcard-label]");
    if (!label) {
      label = document.createElement("p");
      label.className = "vocabulary-flashcard-label";
      label.dataset.vocabFlashcardLabel = "true";
      container.insertBefore(label, flashcard);
    }
    label.textContent = latestAlreadySaved ? "Saved flashcard" : "Save as flashcard";

    if (latestAlreadySaved) {
      const savePrompt = flashcard.querySelector(":scope > p");
      const saveActions = flashcard.querySelector(".vocabulary-save-actions");
      if (savePrompt) savePrompt.textContent = "Already saved in your flashcards.";
      if (saveActions) saveActions.hidden = true;
      const status = document.querySelector("[data-vocab-lookup-status]");
      if (status) status.textContent = "Already saved — GPT refreshed the explanation.";
    }
  }

  function removeChatResponse() {
    document.querySelector("[data-vocab-chat-response]")?.remove();
    document.querySelector("[data-vocab-flashcard-label]")?.remove();
  }

  function normalizeAnswer(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[\t ]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 2800);
  }

  function renderMarkdown(value) {
    const lines = normalizeAnswer(value).split("\n");
    const output = [];
    let listOpen = false;

    const closeList = () => {
      if (!listOpen) return;
      output.push("</ul>");
      listOpen = false;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        continue;
      }

      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        if (!listOpen) {
          output.push("<ul>");
          listOpen = true;
        }
        output.push(`<li>${renderInlineMarkdown(bullet[1])}</li>`);
        continue;
      }

      closeList();
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      if (heading) {
        output.push(`<h3>${renderInlineMarkdown(heading[1])}</h3>`);
        continue;
      }
      output.push(`<p>${renderInlineMarkdown(line)}</p>`);
    }

    closeList();
    return output.join("");
  }

  function renderInlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const observer = new MutationObserver(() => {
    if (latestAnswer) scheduleRender();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.JoyVocabularyChatResponse = Object.freeze({ normalizeAnswer, renderMarkdown });
})();