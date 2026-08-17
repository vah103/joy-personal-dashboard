const SALE_SCOPE_SELECTOR = "#sales, #sales-modal, #sales-assistant-modal, #sale-close-deal-modal, #room-summary-card, .sale-page";
const I18N_MODULE_URL = "/i18n/index.js?v=joy-i18n-v1";
const I18N_STYLE_URL = "/i18n/i18n.css?v=joy-i18n-v1";
const I18N_BINDINGS = Object.freeze([
  ["data-i18n", "textContent"],
  ["data-i18n-placeholder", "placeholder"],
  ["data-i18n-aria-label", "aria-label"],
  ["data-i18n-title", "title"],
]);
const I18N_SELECTOR = I18N_BINDINGS.map(([attribute]) => `[${attribute}]`).join(",");
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

export function saleText(key, fallback = "", values = {}) {
  const translated = sharedI18n()?.t?.(key, values);
  return translated && translated !== key ? translated : fallback || translated || key;
}

function translateExplicitNode(element, i18n) {
  for (const [attribute, target] of I18N_BINDINGS) {
    const key = element.getAttribute?.(attribute);
    if (!key) continue;
    const translated = i18n.t?.(key);
    if (!translated || translated === key) continue;
    if (target === "textContent") element.textContent = translated;
    else element.setAttribute(target, translated);
  }
}

function translateExplicitRoot(root, i18n) {
  const elements = [];
  if (root?.nodeType === 1 && root.matches?.(I18N_SELECTOR)) elements.push(root);
  root?.querySelectorAll?.(I18N_SELECTOR).forEach((element) => elements.push(element));
  elements.forEach((element) => translateExplicitNode(element, i18n));
}

export function translateSaleUiRoot(root) {
  const i18n = sharedI18n();
  if (!i18n?.t || !root) return;
  const element = root.nodeType === 1 ? root : root.parentElement;
  if (!element) return;
  const scopes = new Set();
  const closest = element.matches?.(SALE_SCOPE_SELECTOR) ? element : element.closest?.(SALE_SCOPE_SELECTOR);
  if (closest) scopes.add(closest);
  element.querySelectorAll?.(SALE_SCOPE_SELECTOR).forEach((scope) => scopes.add(scope));
  scopes.forEach((scope) => translateExplicitRoot(scope, i18n));
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

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void installSaleEnglishUi(document), { once: true });
  } else {
    void installSaleEnglishUi(document);
  }
}
