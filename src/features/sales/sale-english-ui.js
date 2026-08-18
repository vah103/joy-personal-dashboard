import {
  installSaleEnglishUi as installSaleLanguageUi,
  translateSaleUiRoot,
  translateSaleUiText,
} from "./shared/i18n.js";
import { formatRoomSummarySource } from "./room-summary/formatter.js";
import { installRoomSummaryPassThrough } from "./room-summary/room-summary.js";

// Compatibility entry only. Shared translations remain owned by JoyI18n at /i18n/index.js.
export { formatRoomSummarySource, translateSaleUiRoot, translateSaleUiText };

export async function installSaleEnglishUi(doc = globalThis.document) {
  installRoomSummaryPassThrough(doc);
  await installSaleLanguageUi(doc);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void installSaleEnglishUi(document), { once: true });
  } else {
    void installSaleEnglishUi(document);
  }
}
