const SALE_SCOPE_SELECTOR = "#sales, #sales-modal, #sales-assistant-modal, #room-summary-card, .sale-page";
const I18N_MODULE_URL = "/i18n/index.js?v=joy-i18n-v1";
const I18N_STYLE_URL = "/i18n/i18n.css?v=joy-i18n-v1";
const JOY_ROOM_CHATGPT_URL = "https://chatgpt.com/";
const JOY_ROOM_TEXT_PLACEHOLDER = `Địa chỉ: ...

Phòng:
- P203 | 6tr8 | 6/9

Dạng phòng: 1N1K
Thang máy: Có
Nội thất: Như hình

Dịch vụ:
- Điện: 4k/số
- Nước: 35k/khối

Lưu ý:
- ...`;
let i18nPromise = null;
let roomComposerObserver = null;

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

function roomText(key, fallback) {
  return sharedI18n()?.t?.(key) || fallback;
}

function syncRoomSummaryComposer(doc = globalThis.document) {
  const composer = doc?.querySelector?.('[data-assistant-panel="summary"] .sale-room-composer');
  const input = composer?.querySelector?.("#room-summary-input");
  if (!composer || !input) return false;

  const label = composer.querySelector('label[for="room-summary-input"]');
  if (label) label.textContent = roomText("dynamic.sale.roomTextLabel", "Joy Room Text");

  input.placeholder = roomText("dynamic.sale.roomTextPlaceholder", JOY_ROOM_TEXT_PLACEHOLDER);

  const help = input.nextElementSibling?.tagName === "P" ? input.nextElementSibling : null;
  if (help) {
    help.textContent = roomText(
      "dynamic.sale.roomTextHelp",
      "Paste only Joy Room Text prepared in ChatGPT. Raw listings are not accepted.",
    );
  }

  let button = composer.querySelector("#room-summary-chatgpt");
  if (!button) {
    button = doc.createElement("button");
    button.type = "button";
    button.id = "room-summary-chatgpt";
    button.className = "secondary-button";
    button.style.width = "100%";
    button.style.marginBottom = "12px";
    button.addEventListener("click", () => {
      globalThis.window?.open?.(JOY_ROOM_CHATGPT_URL, "_blank", "noopener,noreferrer");
    });
    input.before(button);
  }

  button.textContent = roomText("dynamic.sale.roomChatGPT", "Soạn với ChatGPT ↗");
  return true;
}

function installRoomSummaryComposer(doc = globalThis.document) {
  if (!doc?.body) return;
  syncRoomSummaryComposer(doc);

  if (!roomComposerObserver && typeof MutationObserver !== "undefined") {
    roomComposerObserver = new MutationObserver(() => syncRoomSummaryComposer(doc));
    roomComposerObserver.observe(doc.body, { childList: true, subtree: true });
  }

  const sync = () => syncRoomSummaryComposer(doc);
  globalThis.window?.addEventListener?.("joy:i18n-ready", sync);
  globalThis.window?.addEventListener?.("joy:locale-changed", sync);
}

export async function installSaleEnglishUi(doc = globalThis.document) {
  if (!doc?.body || doc.body.dataset.saleLanguageAdapter === "true") return;
  doc.body.dataset.saleLanguageAdapter = "true";
  ensureI18nStyle(doc);
  installRoomSummaryComposer(doc);

  const sync = () => {
    syncRoomSummaryComposer(doc);
    translateSaleUiRoot(doc.body);
  };
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

export { JOY_ROOM_CHATGPT_URL, JOY_ROOM_TEXT_PLACEHOLDER, syncRoomSummaryComposer };
