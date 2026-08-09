(() => {
  if (window.__joyVocabularyChatResponseInstalled) return;
  window.__joyVocabularyChatResponseInstalled = true;

  const LOOKUP_PATH = "/api/vocabulary/lookup";
  const nativeFetch = window.fetch.bind(window);
  let latestAnswer = "";
  let renderScheduled = false;

  window.fetch = async function joyVocabularyFetch(input, init = {}) {
    const requestUrl = typeof input === "string" || input instanceof URL ? String(input) : input?.url || "";
    const method = String(init.method || input?.method || "GET").toUpperCase();
    const isLookup = method === "POST" && pathnameFor(requestUrl) === LOOKUP_PATH;

    if (isLookup) {
      latestAnswer = "";
      removeChatResponse();
    }

    const response = await nativeFetch(input, init);
    if (!isLookup) return response;

    response.clone().json().then((payload) => {
      latestAnswer = normalizeAnswer(payload?.answerMarkdown || payload?.answer_markdown);
      scheduleRender();
    }).catch(() => {
      latestAnswer = "";
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
    if (renderScheduled) return;
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

    let response = container.querySelector("[data-vocab-chat-response]");
    if (!response) {
      response = document.createElement("section");
      response.className = "vocabulary-chat-response";
      response.dataset.vocabChatResponse = "true";
      response.setAttribute("aria-label", "ChatGPT vocabulary explanation");
      container.insertBefore(response, flashcard);
    }

    response.innerHTML = `
      <div class="vocabulary-chat-response-heading">
        <span aria-hidden="true">✦</span>
        <div><small>ChatGPT answer</small><strong>Explanation</strong></div>
      </div>
      <div class="vocabulary-chat-response-body">${renderMarkdown(latestAnswer)}</div>
    `;

    if (!container.querySelector("[data-vocab-flashcard-label]")) {
      const label = document.createElement("p");
      label.className = "vocabulary-flashcard-label";
      label.dataset.vocabFlashcardLabel = "true";
      label.textContent = "Save as flashcard";
      container.insertBefore(label, flashcard);
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
      .slice(0, 5000);
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

  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.JoyVocabularyChatResponse = Object.freeze({ normalizeAnswer, renderMarkdown });
})();
