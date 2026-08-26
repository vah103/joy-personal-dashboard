(() => {
  const STYLESHEET_URLS = [
    "/project-data/vocabulary/vocabulary.css?v=joy-vocabulary-v1",
    "/project-data/vocabulary/vocabulary-compact.css?v=joy-vocabulary-compact-v3&ui=stable-entry-v1",
    "/project-data/vocabulary/vocabulary-practice-redesign.css?v=joy-vocabulary-practice-redesign-v3",
    "/project-data/vocabulary/vocabulary-library.css?v=joy-vocabulary-library-v4&ui=example-flashcards-v1",
    "/project-data/vocabulary/vocabulary-library-tools.css?v=joy-vocabulary-library-tools-v1",
  ];

  const SCRIPTS = Object.freeze({
    browserSpeech: {
      attribute: "data-joy-browser-speech",
      url: "/project-data/shared/browser-speech.js?v=joy-browser-speech-v1",
      version: "joy-browser-speech-v1",
    },
    vocabulary: {
      attribute: "data-joy-vocabulary",
      url: "/project-data/vocabulary/vocabulary.js?v=joy-vocabulary-v5",
      version: "joy-vocabulary-v5",
    },
    practice: {
      attribute: "data-joy-vocabulary-practice-redesign",
      url: "/project-data/vocabulary/vocabulary-practice-redesign.js?v=joy-vocabulary-practice-redesign-v1",
      version: "joy-vocabulary-practice-redesign-v1",
    },
    compact: {
      attribute: "data-joy-vocabulary-compact",
      url: "/project-data/vocabulary/vocabulary-compact.js?v=joy-vocabulary-compact-v5",
      version: "joy-vocabulary-compact-v5",
    },
    library: {
      attribute: "data-joy-vocabulary-library",
      url: "/project-data/vocabulary/vocabulary-library.js?v=joy-vocabulary-library-v3&ui=example-flashcards-v1",
      version: "joy-vocabulary-library-v3",
    },
    libraryTools: {
      attribute: "data-joy-vocabulary-library-tools",
      url: "/project-data/vocabulary/vocabulary-library-tools.js?v=joy-vocabulary-library-tools-v2",
      version: "joy-vocabulary-library-tools-v2",
    },
    mobile: {
      attribute: "data-joy-vocabulary-mobile-inline",
      url: "/project-data/vocabulary/vocabulary-mobile-inline.js?v=joy-vocabulary-mobile-inline-v3",
      version: "joy-vocabulary-mobile-inline-v3",
    },
  });

  function installCompactCriticalStyle() {
    if (document.querySelector('style[data-joy-vocabulary-compact-shell="true"]')) return;
    const style = document.createElement("style");
    style.dataset.joyVocabularyCompactShell = "true";
    style.textContent = `
      .sidebar .vocabulary-widget {
        min-height: 116px;
        margin-top: 18px;
        overflow: hidden;
        border: 1px solid rgba(66, 72, 74, 0.14);
        border-radius: 18px;
        background: rgba(247, 246, 242, 0.5);
        box-shadow: inset 0 1px rgba(255, 255, 255, 0.52);
      }
      .vocabulary-compact-card {
        min-height: 116px;
        padding: 10px 11px 11px;
        display: grid;
        gap: 10px;
      }
      .vocabulary-compact-topline {
        min-height: 22px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .vocabulary-compact-preview,
      .vocabulary-compact-empty {
        min-height: 70px;
        border: 1px solid rgba(66, 72, 74, 0.1);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.58);
      }
      .vocabulary-compact-dynamic {
        opacity: 0;
        transform: translateY(4px);
      }
    `;
    document.head.append(style);
  }

  function compactShellMarkup() {
    return `
      <section class="vocabulary-compact-card is-loading" aria-label="Vocabulary" data-vocab-compact-shell>
        <div class="vocabulary-compact-topline" role="button" tabindex="0">
          <div class="vocabulary-compact-title">
            <strong>Words</strong>
            <span class="vocabulary-compact-dynamic" data-vocab-compact-count>…</span>
          </div>
        </div>
        <button class="vocabulary-compact-preview" type="button" data-vocab-open-practice disabled>
          <strong class="vocabulary-compact-dynamic" data-vocab-compact-prompt>&nbsp;</strong>
        </button>
        <div class="vocabulary-compact-empty" data-vocab-compact-empty hidden>
          <small class="vocabulary-compact-dynamic">Add a word</small>
        </div>
      </section>
    `;
  }

  function installCompactShell() {
    const root = document.querySelector('[data-vocab-practice-root="desktop"]');
    if (!root || root.querySelector("[data-vocab-compact-shell]")) return;
    root.innerHTML = compactShellMarkup();
  }

  function loadStyles() {
    STYLESHEET_URLS.forEach((href) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = href;
      stylesheet.dataset.joyVocabulary = "true";
      document.head.append(stylesheet);
    });
  }

  function loadScript(config, next, { tolerateError = false } = {}) {
    const selector = `script[${config.attribute}="true"]`;
    const existing = document.querySelector(selector);
    if (existing && existing.src.includes(config.version)) {
      if (existing.dataset.loaded === "true") next?.();
      else {
        existing.addEventListener("load", next, { once: true });
        if (tolerateError) existing.addEventListener("error", next, { once: true });
      }
      return;
    }
    existing?.remove();

    const script = document.createElement("script");
    script.src = config.url;
    script.setAttribute(config.attribute, "true");
    script.addEventListener("load", () => { script.dataset.loaded = "true"; }, { once: true });
    if (next) script.addEventListener("load", next, { once: true });
    if (next && tolerateError) script.addEventListener("error", next, { once: true });
    document.body.append(script);
  }

  function normalizeLibraryAddButton() {
    const button = document.querySelector("[data-vocab-library-add]");
    if (button) {
      const accessibleLabel = button.textContent.replace(/^\s*\+\s*/, "").trim() || "Add";
      button.textContent = "+";
      button.setAttribute("aria-label", accessibleLabel);
      button.setAttribute("title", accessibleLabel);
    }
    loadScript(SCRIPTS.libraryTools, loadMobileInline, { tolerateError: true });
  }

  function loadMobileInline() {
    loadScript(SCRIPTS.mobile);
  }

  function loadLibrary() {
    loadScript(SCRIPTS.library, normalizeLibraryAddButton, { tolerateError: true });
  }

  function loadCompactCard() {
    loadScript(SCRIPTS.compact, loadLibrary);
  }

  function loadPracticeRedesign() {
    loadScript(SCRIPTS.practice, loadCompactCard, { tolerateError: true });
  }

  function loadVocabulary() {
    loadScript(SCRIPTS.vocabulary, loadPracticeRedesign);
  }

  function loadBrowserSpeech() {
    if (window.__joyBrowserSpeechInstalled) {
      loadVocabulary();
      return;
    }
    loadScript(SCRIPTS.browserSpeech, loadVocabulary, { tolerateError: true });
  }

  function load() {
    installCompactCriticalStyle();
    installCompactShell();
    loadStyles();
    loadBrowserSpeech();
  }

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", load, { once: true });
  else load();
})();
