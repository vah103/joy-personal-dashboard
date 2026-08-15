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

function translated(key, fallback) {
  return globalThis.window?.JoyI18n?.t?.(key) || fallback;
}

function syncRoomComposerCopy(composer) {
  const input = composer?.querySelector("#room-summary-input");
  if (!input) return;

  const label = composer.querySelector('label[for="room-summary-input"]');
  if (label) label.textContent = translated("dynamic.sale.roomTextLabel", "Joy Room Text");

  input.placeholder = JOY_ROOM_TEXT_PLACEHOLDER;

  const help = input.nextElementSibling?.tagName === "P" ? input.nextElementSibling : null;
  if (help) {
    help.textContent = translated(
      "dynamic.sale.roomTextHelp",
      "Paste only Joy Room Text prepared in ChatGPT. Raw listings are not accepted.",
    );
  }

  let button = composer.querySelector("#room-summary-chatgpt");
  if (!button) {
    button = document.createElement("button");
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

  button.textContent = translated("dynamic.sale.roomChatGPT", "Soạn với ChatGPT ↗");
}

function installRoomChatGPTLauncher(doc = globalThis.document) {
  if (!doc?.body) return;

  const sync = () => {
    const composer = doc.querySelector('[data-assistant-panel="summary"] .sale-room-composer');
    if (composer) syncRoomComposerCopy(composer);
  };

  sync();

  const observer = new MutationObserver(sync);
  observer.observe(doc.body, { childList: true, subtree: true });

  globalThis.window?.addEventListener?.("joy:i18n-ready", sync);
  globalThis.window?.addEventListener?.("joy:locale-changed", sync);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => installRoomChatGPTLauncher(document), { once: true });
  } else {
    installRoomChatGPTLauncher(document);
  }
}

export { JOY_ROOM_CHATGPT_URL, JOY_ROOM_TEXT_PLACEHOLDER, installRoomChatGPTLauncher };
