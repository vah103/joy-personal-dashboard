const STORAGE_KEY = "joy-ui-language-v1";
const MESSAGE_TYPE = "JOY_UI_LOCALE";
const SUPPORTED = new Set(["en", "vi"]);

function currentLocale() {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.has(saved) ? saved : "en";
  } catch {
    return "en";
  }
}

async function postLocale(locale = currentLocale()) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const selected = SUPPORTED.has(locale) ? locale : "en";
  const message = { type: MESSAGE_TYPE, locale: selected };

  try {
    navigator.serviceWorker.controller?.postMessage(message);
  } catch {
    // The active registration path below is the reliable fallback.
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage(message);
  } catch {
    // Locale sync is best-effort and must never block the UI.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("joy:i18n-ready", (event) => {
    void postLocale(event.detail?.locale);
  });
  window.addEventListener("joy:locale-changed", (event) => {
    void postLocale(event.detail?.locale);
  });
  window.addEventListener("load", () => void postLocale(), { once: true });
  queueMicrotask(() => void postLocale());
}

export { postLocale as syncServiceWorkerLocale };
