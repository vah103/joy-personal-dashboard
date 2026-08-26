(() => {
  const STYLESHEET_URLS = [
    "/project-data/vocabulary/vocabulary.css?v=joy-vocabulary-v1",
    "/project-data/vocabulary/vocabulary-compact.css?v=joy-vocabulary-compact-v2&ui=minimal-word-v1",
    "/project-data/vocabulary/vocabulary-practice-redesign.css?v=joy-vocabulary-practice-redesign-v2",
    "/project-data/vocabulary/vocabulary-library.css?v=joy-vocabulary-library-v3&ui=readonly-doubleclick-delete-v1",
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
      url: "/project-data/vocabulary/vocabulary.js?v=joy-vocabulary-v2",
      version: "joy-vocabulary-v2",
    },
    practice: {
      attribute: "data-joy-vocabulary-practice-redesign",
      url: "/project-data/vocabulary/vocabulary-practice-redesign.js?v=joy-vocabulary-practice-redesign-v1",
      version: "joy-vocabulary-practice-redesign-v1",
    },
    compact: {
      attribute: "data-joy-vocabulary-compact",
      url: "/project-data/vocabulary/vocabulary-compact.js?v=joy-vocabulary-compact-v3",
      version: "joy-vocabulary-compact-v3",
    },
    library: {
      attribute: "data-joy-vocabulary-library",
      url: "/project-data/vocabulary/vocabulary-library.js?v=joy-vocabulary-library-v2&ui=readonly-doubleclick-delete-v1",
      version: "joy-vocabulary-library-v2",
    },
    libraryTools: {
      attribute: "data-joy-vocabulary-library-tools",
      url: "/project-data/vocabulary/vocabulary-library-tools.js?v=joy-vocabulary-library-tools-v1",
      version: "joy-vocabulary-library-tools-v1",
    },
    mobile: {
      attribute: "data-joy-vocabulary-mobile-inline",
      url: "/project-data/vocabulary/vocabulary-mobile-inline.js?v=joy-vocabulary-mobile-inline-v3",
      version: "joy-vocabulary-mobile-inline-v3",
    },
  });

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
    loadStyles();
    loadBrowserSpeech();
  }

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", load, { once: true });
  else load();
})();
