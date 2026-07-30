(() => {
  const STYLESHEET_URL = "/project-data/speaking/speaking.css?v=joy-speaking-v1";
  const SCRIPT_URL = "/project-data/speaking/speaking.js?v=joy-speaking-v1";

  function load() {
    if (!document.querySelector('link[data-joy-speaking="true"]')) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = STYLESHEET_URL;
      stylesheet.dataset.joySpeaking = "true";
      document.head.append(stylesheet);
    }

    if (document.querySelector('script[data-joy-speaking="true"]')) return;
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.dataset.joySpeaking = "true";
    document.body.append(script);
  }

  window.JoySpeakingLoader = Object.freeze({ load });
})();
