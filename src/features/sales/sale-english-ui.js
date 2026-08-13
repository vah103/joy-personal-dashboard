const SALE_SCOPE_SELECTOR = "#sales, #sales-modal, #sales-assistant-modal, #room-summary-card, .sale-page";

function sharedI18n() {
  return globalThis.window?.JoyI18n || globalThis.JoyI18n || null;
}

export function translateSaleUiText(value) {
  const i18n = sharedI18n();
  return i18n?.translateText ? i18n.translateText(value) : String(value ?? "");
}

export function translateSaleUiRoot(root) {
  const i18n = sharedI18n();
  if (!i18n?.translateRoot || !root) return;
  const element = root.nodeType === 1 ? root : root.parentElement;
  if (!element) return;
  const scopes = new Set();
  const closest = element.matches?.(SALE_SCOPE_SELECTOR) ? element : element.closest?.(SALE_SCOPE_SELECTOR);
  if (closest) scopes.add(closest);
  element.querySelectorAll?.(SALE_SCOPE_SELECTOR).forEach((scope) => scopes.add(scope));
  scopes.forEach((scope) => i18n.translateRoot(scope));
}

export function installSaleEnglishUi(doc = globalThis.document) {
  if (!doc?.body || doc.body.dataset.saleLanguageAdapter === "true") return;
  doc.body.dataset.saleLanguageAdapter = "true";

  const sync = () => translateSaleUiRoot(doc.body);
  if (sharedI18n()) sync();
  globalThis.window?.addEventListener?.("joy:i18n-ready", sync);
  globalThis.window?.addEventListener?.("joy:locale-changed", sync);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => installSaleEnglishUi(document), { once: true });
  } else {
    installSaleEnglishUi(document);
  }
}
