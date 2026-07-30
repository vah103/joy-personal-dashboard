(() => {
  const STYLESHEET_URL = "/project-data/vocabulary/vocabulary.css?v=joy-vocabulary-v1";
  const SCRIPT_URL = "/project-data/vocabulary/vocabulary.js?v=joy-vocabulary-v1";
  const MOBILE_SCRIPT_URL = "/project-data/vocabulary/vocabulary-mobile-inline.js?v=joy-vocabulary-mobile-inline-v2";

  const loadSpeaking = () => window.JoySpeakingLoader?.load();

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
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
    }, { once: true });
    script.addEventListener("load", loadSpeaking, { once: true });
    document.body.append(script);
  }

  function load() {
    if (!document.querySelector('link[data-joy-vocabulary="true"]')) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = STYLESHEET_URL;
      stylesheet.dataset.joyVocabulary = "true";
      document.head.append(stylesheet);
    }

    const existing = document.querySelector('script[data-joy-vocabulary="true"]');
    if (existing) {
      if (window.JoyVocabulary) loadMobileInline();
      else existing.addEventListener("load", loadMobileInline, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.dataset.joyVocabulary = "true";
    script.addEventListener("load", loadMobileInline, { once: true });
    document.body.append(script);
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();
