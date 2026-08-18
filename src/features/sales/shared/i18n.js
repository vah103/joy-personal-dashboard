const SALE_SCOPE_SELECTOR = "#sales, #sales-modal, #sales-assistant-modal, #room-summary-card, .sale-page";
const I18N_MODULE_URL = "/i18n/index.js?v=joy-i18n-v1";
const I18N_STYLE_URL = "/i18n/i18n.css?v=joy-i18n-v1";
let i18nPromise = null;

function sharedI18n() {
  return globalThis.window?.JoyI18n || globalThis.JoyI18n || null;
}

function ensureI18nStyle(doc = globalThis.document) {
  if (!doc?.head || doc.querySelector('link[data-joy-i18n-style="true"]')) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = I18N_STYLE_URL;
  link.dataset.joyI18nStyle = "true";
  doc.head.append(link);
}

async function ensureSharedI18n(doc = globalThis.document) {
  if (sharedI18n()) return sharedI18n();
  ensureI18nStyle(doc);
  if (!i18nPromise) i18nPromise = import(I18N_MODULE_URL).catch(() => null);
  await i18nPromise;
  return sharedI18n();
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

export async function installSaleEnglishUi(doc = globalThis.document) {
  if (!doc?.body || doc.body.dataset.saleLanguageAdapter === "true") return;
  doc.body.dataset.saleLanguageAdapter = "true";
  ensureI18nStyle(doc);

  const sync = () => translateSaleUiRoot(doc.body);
  globalThis.window?.addEventListener?.("joy:i18n-ready", sync);
  globalThis.window?.addEventListener?.("joy:locale-changed", sync);
  await ensureSharedI18n(doc);
  sync();
}
