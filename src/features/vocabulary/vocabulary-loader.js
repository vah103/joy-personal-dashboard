(() => {
  const STYLESHEET_URLS = [
    "/project-data/vocabulary/vocabulary.css?v=joy-vocabulary-v1",
    "/project-data/vocabulary/vocabulary-openai.css?v=joy-vocabulary-openai-v2",
    "/project-data/vocabulary/vocabulary-result-size.css?v=joy-vocabulary-result-size-v1",
    "/project-data/vocabulary/vocabulary-modal-fit.css?v=joy-vocabulary-modal-fit-v1",
    "/project-data/vocabulary/vocabulary-compact.css?v=joy-vocabulary-compact-v2",
    "/project-data/vocabulary/vocabulary-library.css?v=joy-vocabulary-library-v3&ui=readonly-doubleclick-delete-v1",
    "/project-data/vocabulary/vocabulary-library-tools.css?v=joy-vocabulary-library-tools-v1",
  ];
  const BROWSER_SPEECH_SCRIPT_URL = "/project-data/shared/browser-speech.js?v=joy-browser-speech-v1";
  const SCRIPT_URL = "/project-data/vocabulary/vocabulary.js?v=joy-vocabulary-v2";
  const COMPACT_SCRIPT_URL = "/project-data/vocabulary/vocabulary-compact.js?v=joy-vocabulary-compact-v3";
  const LIBRARY_SCRIPT_URL = "/project-data/vocabulary/vocabulary-library.js?v=joy-vocabulary-library-v2&ui=readonly-doubleclick-delete-v1";
  const LIBRARY_TOOLS_SCRIPT_URL = "/project-data/vocabulary/vocabulary-library-tools.js?v=joy-vocabulary-library-tools-v1";
  const MOBILE_SCRIPT_URL = "/project-data/vocabulary/vocabulary-mobile-inline.js?v=joy-vocabulary-mobile-inline-v3";

  const loadSpeaking = () => window.JoySpeakingLoader?.load();

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

  function loadMobileInline() {
    const existing = document.querySelector('script[data-joy-vocabulary-mobile-inline="true"]');
    if (existing && existing.src.includes("joy-vocabulary-mobile-inline-v3")) {
      if (existing.dataset.loaded === "true") loadSpeaking();
      else existing.addEventListener("load", loadSpeaking, { once: true });
      return;
    }
    existing?.remove();

    const script = document.createElement("script");
    script.src = MOBILE_SCRIPT_URL;
    script.dataset.joyVocabularyMobileInline = "true";
    script.addEventListener("load", () => { script.dataset.loaded = "true"; }, { once: true });
    script.addEventListener("load", loadSpeaking, { once: true });
    document.body.append(script);
  }

  function loadLibraryTools() {
    const existing = document.querySelector('script[data-joy-vocabulary-library-tools="true"]');
    if (existing && existing.src.includes("joy-vocabulary-library-tools-v1")) {
      if (existing.dataset.loaded === "true") loadMobileInline();
      else existing.addEventListener("load", loadMobileInline, { once: true });
      return;
    }
    existing?.remove();

    const script = document.createElement("script");
    script.src = LIBRARY_TOOLS_SCRIPT_URL;
    script.dataset.joyVocabularyLibraryTools = "true";
    script.addEventListener("load", () => { script.dataset.loaded = "true"; }, { once: true });
    script.addEventListener("load", loadMobileInline, { once: true });
    script.addEventListener("error", loadMobileInline, { once: true });
    document.body.append(script);
  }

  function loadLibrary() {
    const existing = document.querySelector('script[data-joy-vocabulary-library="true"]');
    if (existing && existing.src.includes("joy-vocabulary-library-v2&ui=readonly-doubleclick-delete-v1")) {
      if (existing.dataset.loaded === "true") loadLibraryTools();
      else existing.addEventListener("load", loadLibraryTools, { once: true });
      return;
    }
    existing?.remove();

    const script = document.createElement("script");
    script.src = LIBRARY_SCRIPT_URL;
    script.dataset.joyVocabularyLibrary = "true";
    script.addEventListener("load", () => { script.dataset.loaded = "true"; }, { once: true });
    script.addEventListener("load", loadLibraryTools, { once: true });
    script.addEventListener("error", loadLibraryTools, { once: true });
    document.body.append(script);
  }

  function loadCompactCard() {
    const existing = document.querySelector('script[data-joy-vocabulary-compact="true"]');
    if (existing && existing.src.includes("joy-vocabulary-compact-v3")) {
      if (existing.dataset.loaded === "true") loadLibrary();
      else existing.addEventListener("load", loadLibrary, { once: true });
      return;
    }
    existing?.remove();

    const script = document.createElement("script");
    script.src = COMPACT_SCRIPT_URL;
    script.dataset.joyVocabularyCompact = "true";
    script.addEventListener("load", () => { script.dataset.loaded = "true"; }, { once: true });
    script.addEventListener("load", loadLibrary, { once: true });
    document.body.append(script);
  }

  function loadVocabulary() {
    const existing = document.querySelector('script[data-joy-vocabulary="true"]');
    if (existing && existing.src.includes("joy-vocabulary-v2")) {
      if (window.JoyVocabulary) loadCompactCard();
      else existing.addEventListener("load", loadCompactCard, { once: true });
      return;
    }
    existing?.remove();

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.dataset.joyVocabulary = "true";
    script.addEventListener("load", loadCompactCard, { once: true });
    document.body.append(script);
  }

  function loadBrowserSpeech() {
    const existing = document.querySelector('script[data-joy-browser-speech="true"]');
    if (existing && existing.src.includes("joy-browser-speech-v1")) {
      if (existing.dataset.loaded === "true" || window.__joyBrowserSpeechInstalled) loadVocabulary();
      else existing.addEventListener("load", loadVocabulary, { once: true });
      return;
    }
    existing?.remove();

    const script = document.createElement("script");
    script.src = BROWSER_SPEECH_SCRIPT_URL;
    script.dataset.joyBrowserSpeech = "true";
    script.addEventListener("load", () => { script.dataset.loaded = "true"; }, { once: true });
    script.addEventListener("load", loadVocabulary, { once: true });
    script.addEventListener("error", loadVocabulary, { once: true });
    document.body.append(script);
  }

  function load() {
    loadStyles();
    loadBrowserSpeech();
  }

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", load, { once: true });
  else load();
})();
