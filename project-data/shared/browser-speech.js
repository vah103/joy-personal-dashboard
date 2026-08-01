(() => {
  if (window.__joyBrowserSpeechInstalled) return;
  window.__joyBrowserSpeechInstalled = true;

  const synth = window.speechSynthesis;
  const supportsSpeech = Boolean(synth && typeof window.SpeechSynthesisUtterance === "function");
  let voices = [];
  let activeToken = 0;

  function refreshVoices() {
    if (!supportsSpeech) return [];
    try {
      voices = synth.getVoices() || [];
    } catch {
      voices = [];
    }
    return voices;
  }

  function chooseEnglishVoice() {
    const available = refreshVoices();
    const english = available.filter((voice) => /^en(?:-|_)/i.test(voice.lang || ""));
    const preferredPatterns = [
      /Google US English/i,
      /Microsoft.*(?:Aria|Jenny|Guy|Ryan)/i,
      /Samantha/i,
      /Daniel/i,
      /Karen/i,
      /English.*United States/i,
    ];

    for (const pattern of preferredPatterns) {
      const match = english.find((voice) => pattern.test(voice.name || ""));
      if (match) return match;
    }

    return english.find((voice) => /^en-US/i.test(voice.lang || ""))
      || english.find((voice) => voice.default)
      || english[0]
      || available.find((voice) => voice.default)
      || null;
  }

  function statusElementFor(button) {
    const vocabularyModal = button.closest("[data-vocab-lookup-modal]");
    if (vocabularyModal) return vocabularyModal.querySelector("[data-vocab-lookup-status]");
    const speakingModal = button.closest("[data-speaking-modal]");
    if (speakingModal) return speakingModal.querySelector("[data-speaking-status]");
    return null;
  }

  function textFor(button) {
    if (button.matches("[data-vocab-speak]")) {
      return button.closest(".vocabulary-result-card")
        ?.querySelector(".vocabulary-result-main strong")
        ?.textContent
        ?.trim() || "";
    }

    if (button.matches("[data-speaking-speak]")) {
      return button.closest(".speaking-result-card")
        ?.querySelector("p")
        ?.textContent
        ?.trim() || "";
    }

    return "";
  }

  function messageForSpeechError(code) {
    if (code === "not-allowed") return "Sound was blocked. Click the speaker again and allow sound for this site.";
    if (code === "voice-unavailable" || code === "synthesis-unavailable") {
      return "No English browser voice is available on this device.";
    }
    if (code === "audio-busy") return "Audio is busy. Wait a moment, then try the speaker again.";
    if (code === "audio-hardware") return "The browser could not access the current audio output.";
    return "The browser could not start speech. Check the tab sound and system audio output.";
  }

  function setButtonState(button, playing) {
    button.classList.toggle("is-speaking", playing);
    button.toggleAttribute("aria-busy", playing);
    button.setAttribute("aria-pressed", playing ? "true" : "false");
  }

  function restoreStatus(status, previousText, token) {
    if (!status || token !== activeToken) return;
    status.textContent = previousText;
  }

  function speak(text, button) {
    const status = statusElementFor(button);
    const previousStatus = status?.textContent || "";

    if (!supportsSpeech) {
      if (status) status.textContent = "Browser speech is not supported on this device.";
      return;
    }

    if (!text) {
      if (status) status.textContent = "There is no English text to play.";
      return;
    }

    const token = ++activeToken;
    setButtonState(button, true);
    if (status) status.textContent = "Starting browser voice…";

    const rate = button.matches("[data-vocab-speak]") ? 0.78 : 0.88;

    const runAttempt = (voice, attempt) => {
      if (token !== activeToken) return;

      let started = false;
      let completed = false;
      let retryStarted = false;
      let watchdog = null;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice?.lang || "en-US";
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;

      const cleanup = () => {
        if (watchdog) window.clearTimeout(watchdog);
      };

      const retryOrFail = (code = "") => {
        if (completed || retryStarted || token !== activeToken) return;
        retryStarted = true;
        completed = true;
        cleanup();
        synth.cancel();

        if (attempt === 0) {
          window.setTimeout(() => runAttempt(null, 1), 140);
          return;
        }

        setButtonState(button, false);
        if (status) status.textContent = messageForSpeechError(code);
      };

      utterance.onstart = () => {
        if (token !== activeToken) return;
        started = true;
        if (status) status.textContent = "Playing browser voice…";
      };

      utterance.onend = () => {
        if (token !== activeToken) return;
        completed = true;
        cleanup();
        setButtonState(button, false);
        window.setTimeout(() => restoreStatus(status, previousStatus, token), 500);
      };

      utterance.onerror = (event) => retryOrFail(event.error || "");

      try {
        synth.cancel();
      } catch {
        // Continue with a fresh utterance even if cancel is unavailable.
      }

      window.setTimeout(() => {
        if (token !== activeToken || completed) return;
        try {
          if (synth.paused) synth.resume();
          synth.speak(utterance);
        } catch {
          retryOrFail("");
          return;
        }

        watchdog = window.setTimeout(() => {
          if (started || completed || token !== activeToken) return;
          try {
            if (synth.paused) synth.resume();
          } catch {
            // The next timeout reports a visible error if speech still cannot start.
          }

          window.setTimeout(() => {
            if (!started && !completed && token === activeToken) retryOrFail("");
          }, 700);
        }, 1300);
      }, 100);
    };

    runAttempt(chooseEnglishVoice(), 0);
  }

  if (supportsSpeech) {
    refreshVoices();
    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", refreshVoices);
    } else if ("onvoiceschanged" in synth) {
      synth.onvoiceschanged = refreshVoices;
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-vocab-speak], [data-speaking-speak]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    speak(textFor(button), button);
  }, true);
})();