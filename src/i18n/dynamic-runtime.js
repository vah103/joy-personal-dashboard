const STORAGE_KEY = "joy-ui-language-v1";
const MONTHS_EN = Object.freeze([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);
const MONTHS_EN_SHORT = Object.freeze([
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]);
const SKIP_SELECTOR = [
  "textarea",
  "input",
  "script",
  "style",
  "[contenteditable='true']",
  "[data-i18n-skip]",
  ".task-title",
  ".history-task-title",
  ".sales-history-table tbody td:nth-child(2)",
  ".sales-history-table tbody td:nth-child(3)",
  ".sales-history-table tbody td:nth-child(4)",
  ".room-share-detail-value",
  ".room-share-service-value",
  ".room-share-note-value",
  ".gmail-message .email-meta strong",
  ".gmail-message h3",
  ".gmail-message p",
].join(",");

let currentLocale = "en";
let translating = false;
let observer = null;

function storedLocale() {
  if (typeof window === "undefined") return "en";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "vi" ? "vi" : "en";
  } catch {
    return "en";
  }
}

function preserveWhitespace(source, replacement) {
  const leading = String(source).match(/^\s*/u)?.[0] || "";
  const trailing = String(source).match(/\s*$/u)?.[0] || "";
  return `${leading}${replacement}${trailing}`;
}

function enMonthNumber(value) {
  const text = String(value || "").trim();
  let index = MONTHS_EN.findIndex((month) => month.toLowerCase() === text.toLowerCase());
  if (index >= 0) return index + 1;
  index = MONTHS_EN_SHORT.findIndex((month) => month.toLowerCase() === text.toLowerCase());
  return index >= 0 ? index + 1 : 0;
}

function translateMonthLabel(value, locale) {
  const text = String(value || "").trim();
  let match = text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?$/iu);
  if (match) {
    if (locale === "en") return text;
    const month = enMonthNumber(match[1]);
    return `Tháng ${month}${match[2] ? ` ${match[2]}` : ""}`;
  }
  match = text.match(/^Tháng\s+(1[0-2]|[1-9])(?:\s+(\d{4}))?$/iu);
  if (match) {
    if (locale === "vi") return text;
    return `${MONTHS_EN[Number(match[1]) - 1]}${match[2] ? ` ${match[2]}` : ""}`;
  }
  return text;
}

function financeStatus(value, locale) {
  const normalized = String(value || "").trim().toLowerCase();
  const meanings = {
    actual: ["Actual", "Thực tế"],
    planned: ["Planned", "Dự kiến"],
    "in progress": ["In progress", "Đang thực hiện"],
    "in-progress": ["In progress", "Đang thực hiện"],
    completed: ["Completed", "Đã hoàn thành"],
    "đang thực hiện": ["In progress", "Đang thực hiện"],
    "thực tế": ["Actual", "Thực tế"],
    "dự kiến": ["Planned", "Dự kiến"],
    "đã hoàn thành": ["Completed", "Đã hoàn thành"],
  };
  const pair = meanings[normalized];
  return pair ? pair[locale === "vi" ? 1 : 0] : String(value || "").trim();
}

function translateDynamicText(value, locale = currentLocale) {
  const source = String(value ?? "");
  const text = source.trim();
  if (!text) return source;
  let match;

  match = text.match(/^(\d+)\s+open\s+tasks?$/iu) || text.match(/^(\d+)\s+công việc (?:đang mở|chưa xong)$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `${match[1]} công việc chưa xong` : `${match[1]} open ${Number(match[1]) === 1 ? "task" : "tasks"}`);

  match = text.match(/^(\d+)\s+upcoming\s+viewings?$/iu) || text.match(/^(\d+)\s+lịch xem sắp tới$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `${match[1]} lịch xem sắp tới` : `${match[1]} upcoming ${Number(match[1]) === 1 ? "viewing" : "viewings"}`);

  match = text.match(/^(\d+)\s+new\s+emails?$/iu) || text.match(/^(\d+)\s+email mới$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `${match[1]} email mới` : `${match[1]} new ${Number(match[1]) === 1 ? "email" : "emails"}`);

  if (/^(?:sales awaiting sync|sale đang chờ đồng bộ)$/iu.test(text)) {
    return preserveWhitespace(source, locale === "vi" ? "Sale đang chờ đồng bộ" : "sales awaiting sync");
  }

  match = text.match(/^(\d+)\s+planned\s+entr(?:y|ies)$/iu) || text.match(/^(\d+)\s+giao dịch dự kiến$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `${match[1]} giao dịch dự kiến` : `${match[1]} planned ${Number(match[1]) === 1 ? "entry" : "entries"}`);

  match = text.match(/^(\d+)\s+entries$/iu) || text.match(/^(\d+)\s+giao dịch$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `${match[1]} giao dịch` : `${match[1]} ${Number(match[1]) === 1 ? "entry" : "entries"}`);

  match = text.match(/^(.+?)\s+(summary|tóm tắt)$/iu);
  if (match) {
    const label = translateMonthLabel(match[1], locale);
    return preserveWhitespace(source, locale === "vi" ? `Tóm tắt ${label}` : `${label} summary`);
  }

  match = text.match(/^(.+?)\s+(?:finance overview|tổng quan tài chính)$/iu);
  if (match) {
    const label = translateMonthLabel(match[1], locale);
    return preserveWhitespace(source, locale === "vi" ? `Tổng quan tài chính ${label}` : `${label} finance overview`);
  }

  match = text.match(/^(.+?)\s*·\s*(?:Carryover is included in Income\.|Số dư chuyển sang được tính trong Thu nhập\.)$/iu);
  if (match) {
    const status = financeStatus(match[1], locale);
    return preserveWhitespace(source, locale === "vi" ? `${status} · Số dư chuyển sang được tính trong Thu nhập.` : `${status} · Carryover is included in Income.`);
  }

  match = text.match(/^(.+?)\s*·\s*(?:Carryover is included in monthly income\.|Số dư chuyển sang được tính trong thu nhập tháng\.)$/iu);
  if (match) {
    const status = financeStatus(match[1], locale);
    return preserveWhitespace(source, locale === "vi" ? `${status} · Số dư chuyển sang được tính trong thu nhập tháng.` : `${status} · Carryover is included in monthly income.`);
  }

  match = text.match(/^(?:Add|Thêm)\s+(income|expense|thu nhập|chi tiêu)$/iu);
  if (match) {
    const income = /^(?:income|thu nhập)$/iu.test(match[1]);
    return preserveWhitespace(source, locale === "vi" ? `Thêm ${income ? "thu nhập" : "chi tiêu"}` : `Add ${income ? "income" : "expense"}`);
  }

  match = text.match(/^(Planned|Actual|Dự kiến|Thực tế)\s*·\s*(\d{4}-\d{2})$/iu);
  if (match) return preserveWhitespace(source, `${financeStatus(match[1], locale)} · ${match[2]}`);

  match = text.match(/^(?:Open|Mở)\s+(.+)$/iu);
  if (match) {
    const month = translateMonthLabel(match[1], locale);
    if (month !== match[1] || enMonthNumber(match[1])) {
      return preserveWhitespace(source, locale === "vi" ? `Mở ${month}` : `Open ${month}`);
    }
  }

  match = text.match(/^Stage\s+(\d+)\s+of\s+(\d+)$/iu) || text.match(/^Giai đoạn\s+(\d+)\/(\d+)$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `Giai đoạn ${match[1]}/${match[2]}` : `Stage ${match[1]} of ${match[2]}`);

  match = text.match(/^(\d+)\s+commands?$/iu) || text.match(/^(\d+)\s+lệnh$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `${match[1]} lệnh` : `${match[1]} ${Number(match[1]) === 1 ? "command" : "commands"}`);

  match = text.match(/^(\d+)\s+recorded\s+sessions?$/iu) || text.match(/^(\d+)\s+buổi đã ghi$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `${match[1]} buổi đã ghi` : `${match[1]} recorded ${Number(match[1]) === 1 ? "session" : "sessions"}`);

  match = text.match(/^Verified\s+(.+)$/iu) || text.match(/^Đã xác minh\s+(.+)$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `Đã xác minh ${match[1]}` : `Verified ${match[1]}`);

  match = text.match(/^(\d+)\s+min$/iu) || text.match(/^(\d+)\s+phút$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `${match[1]} phút` : `${match[1]} min`);

  match = text.match(/^(\d+)\s+saved\s+words?$/iu) || text.match(/^(\d+)\s+từ đã lưu$/iu);
  if (match) return preserveWhitespace(source, locale === "vi" ? `${match[1]} từ đã lưu` : `${match[1]} saved ${Number(match[1]) === 1 ? "word" : "words"}`);

  match = text.match(/^Translate into\s+(English|Vietnamese)$/iu) || text.match(/^Dịch sang\s+(tiếng Anh|tiếng Việt)$/iu);
  if (match) {
    const english = /English|tiếng Anh/iu.test(match[1]);
    return preserveWhitespace(source, locale === "vi" ? `Dịch sang ${english ? "tiếng Anh" : "tiếng Việt"}` : `Translate into ${english ? "English" : "Vietnamese"}`);
  }

  return source;
}

function shouldSkip(node) {
  const parent = node?.parentElement;
  return !parent || Boolean(parent.closest(SKIP_SELECTOR));
}

function translateTextNode(node) {
  if (shouldSkip(node)) return;
  const translated = translateDynamicText(node.nodeValue);
  if (translated !== node.nodeValue) node.nodeValue = translated;
}

function translateAttributes(element) {
  for (const name of ["aria-label", "title", "placeholder"]) {
    const value = element.getAttribute?.(name);
    if (!value) continue;
    const translated = translateDynamicText(value);
    if (translated !== value) element.setAttribute(name, translated);
  }
}

function scan(root = document) {
  if (typeof document === "undefined" || !root || translating) return;
  translating = true;
  try {
    const base = root.nodeType === 9 ? root.documentElement : root;
    if (!base) return;
    if (base.nodeType === 1) translateAttributes(base);
    base.querySelectorAll?.("[aria-label], [title], [placeholder]").forEach(translateAttributes);
    const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(translateTextNode);
  } finally {
    translating = false;
  }
}

function installObserver() {
  if (typeof MutationObserver === "undefined" || !document?.body || observer) return;
  observer = new MutationObserver((mutations) => {
    if (translating) return;
    for (const mutation of mutations) {
      if (mutation.type === "characterData") scan(mutation.target.parentElement);
      if (mutation.type === "attributes") scan(mutation.target);
      mutation.addedNodes?.forEach((node) => {
        if (node.nodeType === 3) scan(node.parentElement);
        else if (node.nodeType === 1) scan(node);
      });
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "title", "placeholder"],
  });
}

function updateLocale(locale) {
  currentLocale = locale === "vi" ? "vi" : "en";
  scan(document);
  installObserver();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  currentLocale = storedLocale();
  window.addEventListener("joy:i18n-ready", (event) => updateLocale(event.detail?.locale));
  window.addEventListener("joy:locale-changed", (event) => updateLocale(event.detail?.locale));
  if (document.readyState !== "loading") queueMicrotask(() => updateLocale(currentLocale));
}

export { translateDynamicText };
