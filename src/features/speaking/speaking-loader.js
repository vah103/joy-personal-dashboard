(() => {
  function load() {
    // Legacy compatibility only. "Say it" now lives inside Saved Words and
    // calls /api/speaking/english directly through the Vocabulary tool UI.
  }

  window.JoySpeakingLoader = Object.freeze({ load });
})();
