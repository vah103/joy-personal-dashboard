(() => {
  const STYLESHEET_URLS = [
    "/project-data/speaking/speaking.css?v=joy-speaking-v1",
    "/project-data/speaking/speaking-openai.css?v=joy-speaking-openai-v1",
  ];
  const SCRIPT_URL = "/project-data/speaking/speaking.js?v=joy-speaking-v2";

  function loadStyles() {
    STYLESHEET_URLS.forEach((href) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = href;
      stylesheet.dataset.joySpeaking = "true";
      document.head.append(stylesheet);
    });
  }

  function load() {
    loadStyles();
    const existing = document.querySelector('script[data-joy-speaking="true"]');
    if (existing && existing.src.includes("joy-speaking-v2")) return;
    existing?.remove();
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.dataset.joySpeaking = "true";
    document.body.append(script);
  }

  window.JoySpeakingLoader = Object.freeze({ load });
})();
