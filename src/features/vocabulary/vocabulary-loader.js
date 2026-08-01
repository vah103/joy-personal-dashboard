(() => {
  const STYLESHEET_URLS = [
    "/project-data/vocabulary/vocabulary.css?v=joy-vocabulary-v1",
    "/project-data/vocabulary/vocabulary-openai.css?v=joy-vocabulary-openai-v1",
    "/project-data/vocabulary/vocabulary-compact.css?v=joy-vocabulary-compact-v1",
  ];
  const SCRIPT_URL = "/project-data/vocabulary/vocabulary.js?v=joy-vocabulary-v2";
  const COMPACT_SCRIPT_URL = "/project-data/vocabulary/vocabulary-compact.js?v=joy-vocabulary-compact-v1";
  const MOBILE_SCRIPT_URL = "/project-data/vocabulary/vocabulary-mobile-inline.js?v=joy-vocabulary-mobile-inline-v2";

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
    if (existing && existing.src.includes("joy-vocabulary-mobile-inline-v2")) {
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

  function loadCompactCard() {
    const existing = document.querySelector('script[data-joy-vocabulary-compact="true"]');
    if (existing && existing.src.includes("joy-vocabulary-compact-v1")) {
      if (existing.dataset.loaded === "true") loadMobileInline();
      else existing.addEventListener("load", loadMobileInline, { once: true });
      return;
    }
    existing?.remove();

    const script = document.createElement("script");
    script.src = COMPACT_SCRIPT_URL;
    script.dataset.joyVocabularyCompact = "true";
    script.addEventListener("load", () => { script.dataset.loaded = "true"; }, { once: true });
    script.addEventListener("load", loadMobileInline, { once: true });
    document.body.append(script);
  }

  function load() {
    loadStyles();
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

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", load, { once: true });
  else load();
})();
