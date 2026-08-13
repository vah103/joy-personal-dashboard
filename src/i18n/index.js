import en from "./locales/en.js";
import vi from "./locales/vi.js";

export const SUPPORTED_LOCALES = Object.freeze(["en", "vi"]);
export const DEFAULT_LOCALE = "en";
export const STORAGE_KEY = "joy-ui-language-v1";
export const LOCALES = Object.freeze({ en, vi });

const BROWSER_LOCALES = Object.freeze({ en: "en-GB", vi: "vi-VN" });
const MONTHS_EN = Object.freeze(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
const MONTHS_EN_LONG = Object.freeze(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
const WEEKDAYS_EN = Object.freeze(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
const WEEKDAYS_VI = Object.freeze(["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"]);
const OBSERVER_OPTIONS = Object.freeze({
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["placeholder", "aria-label", "title"],
});

let currentLocale = readStoredLocale();
let translating = false;
let observer = null;
let observerConnected = false;
let queuedRoots = new Set();
let translationFrame = 0;

function storageAvailable() {
  return typeof window !== "undefined" && window.localStorage;
}

function readStoredLocale() {
  if (!storageAvailable()) return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function writeStoredLocale(locale) {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Language selection still works for the current page without storage.
  }
}

function interpolate(template, values = {}) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  ));
}

function placeholders(value) {
  return [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

export function t(key, values = {}, locale = currentLocale) {
  const selected = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  const template = LOCALES[selected]?.[key] ?? LOCALES[DEFAULT_LOCALE]?.[key] ?? key;
  return interpolate(template, values);
}

export function getLocale() {
  return currentLocale;
}

export function getBrowserLocale(locale = currentLocale) {
  return BROWSER_LOCALES[SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE];
}

export function formatDate(value, options = {}, locale = currentLocale) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(getBrowserLocale(locale), options).format(date);
}

export function formatNumber(value, options = {}, locale = currentLocale) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return new Intl.NumberFormat(getBrowserLocale(locale), options).format(number);
}

export function formatCurrency(value, locale = currentLocale) {
  return formatNumber(value, {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }, locale);
}

const REVERSE_TEXT = buildReverseTextIndex();

function buildReverseTextIndex() {
  const index = new Map();
  for (const locale of SUPPORTED_LOCALES) {
    for (const [key, value] of Object.entries(LOCALES[locale])) {
      if (!value || placeholders(value).length) continue;
      const normalized = String(value).trim();
      if (!normalized) continue;
      const keys = index.get(normalized) || new Set();
      keys.add(key);
      index.set(normalized, keys);
    }
  }
  return index;
}

function keyForExactText(text, locale = currentLocale) {
  const keys = REVERSE_TEXT.get(text);
  if (!keys?.size) return "";
  const candidates = [...keys];
  if (candidates.length === 1) return candidates[0];
  const targets = new Set(candidates.map((key) => LOCALES[locale]?.[key]).filter(Boolean));
  return targets.size === 1 ? candidates[0] : "";
}

function preserveWhitespace(source, replacement) {
  const leading = String(source).match(/^\s*/u)?.[0] || "";
  const trailing = String(source).match(/\s*$/u)?.[0] || "";
  return `${leading}${replacement}${trailing}`;
}

function parseMonthName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const short = MONTHS_EN.findIndex((month) => month.toLowerCase() === normalized);
  if (short >= 0) return short + 1;
  const long = MONTHS_EN_LONG.findIndex((month) => month.toLowerCase() === normalized);
  if (long >= 0) return long + 1;
  const viMatch = normalized.match(/^th(?:á|a)ng\s*(1[0-2]|[1-9])$/u);
  return viMatch ? Number(viMatch[1]) : 0;
}

function localizedMonthYear(month, year, locale = currentLocale, { slash = false } = {}) {
  const number = Number(month);
  if (number < 1 || number > 12) return "";
  if (locale === "vi") return slash ? `Tháng ${number}/${year}` : `Tháng ${number} ${year}`;
  return `${MONTHS_EN_LONG[number - 1]} ${year}`;
}

function localizedMonthOnly(month, locale = currentLocale) {
  const number = Number(month);
  if (number < 1 || number > 12) return "";
  return locale === "vi" ? `Tháng ${number}` : MONTHS_EN_LONG[number - 1];
}

function localizedLanguageLabel(value, locale = currentLocale) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["english", "tiếng anh"].includes(normalized)) return locale === "vi" ? "tiếng Anh" : "English";
  if (["vietnamese", "tiếng việt"].includes(normalized)) return locale === "vi" ? "tiếng Việt" : "Vietnamese";
  return value;
}

function localizedSpeakingTone(value, locale = currentLocale) {
  const normalized = String(value || "").trim().toLowerCase();
  const keys = {
    natural: "speaking.natural",
    "tự nhiên": "speaking.natural",
    casual: "speaking.casual",
    "thân mật": "speaking.casual",
    polite: "speaking.polite",
    "lịch sự": "speaking.polite",
    work: "speaking.work",
    "công việc": "speaking.work",
  };
  return keys[normalized] ? t(keys[normalized], {}, locale) : value;
}

function formatViewingDate(day, month, year, time, locale = currentLocale) {
  const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return "";
  const weekday = locale === "vi" ? WEEKDAYS_VI[date.getDay()] : WEEKDAYS_EN[date.getDay()];
  if (locale === "vi") return `${weekday}, ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year} · ${time}`;
  return `${weekday}, ${String(day).padStart(2, "0")} ${MONTHS_EN[month - 1]} ${year} · ${time}`;
}

function dynamicTranslation(text, locale = currentLocale) {
  let match = text.match(/^(Th\s*[2-7]|CN),\s*(\d{2})\/(\d{2})\/(\d{4})\s*·\s*(\d{2}:\d{2})$/u);
  if (match) return formatViewingDate(Number(match[2]), Number(match[3]), match[4], match[5], locale);

  match = text.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s*·\s*(\d{2}:\d{2})$/u);
  if (match) return formatViewingDate(Number(match[2]), parseMonthName(match[3]), match[4], match[5], locale);

  match = text.match(/^(\d+)\s+(?:lịch hẹn|appointments?)$/iu);
  if (match) return t("saleAssistant.appointmentCount", { count: match[1] }, locale);

  match = text.match(/^(\d+)\s+phòng\s*·\s*Trống từ\s+(.+)$/iu);
  if (match) return t("saleAssistant.availableCount", { count: match[1], date: match[2] }, locale);
  match = text.match(/^(\d+)\s+rooms\s*·\s*Available from\s+(.+)$/iu);
  if (match) return t("saleAssistant.availableCount", { count: match[1], date: match[2] }, locale);

  match = text.match(/^(\d+)\s+phòng\s*·\s*Vào luôn$/iu);
  if (match) return t("saleAssistant.availableCountNow", { count: match[1] }, locale);
  match = text.match(/^(\d+)\s+rooms\s*·\s*Available now$/iu);
  if (match) return t("saleAssistant.availableCountNow", { count: match[1] }, locale);

  match = text.match(/^(?:Từ|From)\s+(.+)$/iu);
  if (match) return t("saleAssistant.availableFrom", { date: match[1] }, locale);

  match = text.match(/^(.+)\s+\((?:trống|available from)\s+(.+)\)$/iu);
  if (match) return t("saleAssistant.availableSuffix", { rooms: match[1], date: match[2] }, locale);

  match = text.match(/^(\d+)\s+open$/iu);
  if (match) return t("tasks.openCount", { count: match[1] }, locale);

  match = text.match(/^(\d+)\s+total\s*·\s*(\d+)\s+open\s*·\s*(\d+)\s+completed$/iu);
  if (match) return t("tasks.totalSummary", { total: match[1], open: match[2], completed: match[3] }, locale);
  match = text.match(/^(\d+)\s+tổng\s*·\s*(\d+)\s+đang mở\s*·\s*(\d+)\s+đã hoàn thành$/iu);
  if (match) return t("tasks.totalSummary", { total: match[1], open: match[2], completed: match[3] }, locale);

  match = text.match(/^(\d+)\/(\d+)\s+(?:tasks completed|task đã hoàn thành)$/iu);
  if (match) return t("ielts.tasksCompleted", { done: match[1], total: match[2] }, locale);

  match = text.match(/^(\d+)\s+saved$/iu);
  if (match) return t("ielts.savedCount", { count: match[1] }, locale);
  match = text.match(/^Đã lưu\s+(\d+)$/iu);
  if (match) return t("ielts.savedCount", { count: match[1] }, locale);

  match = text.match(/^(\d+)%\s+complete$/iu);
  if (match) return t("ielts.completePercent", { value: match[1] }, locale);
  match = text.match(/^Hoàn thành\s+(\d+)%$/iu);
  if (match) return t("ielts.completePercent", { value: match[1] }, locale);

  match = text.match(/^Tháng\s+(1[0-2]|[1-9])\/(\d{4})$/u);
  if (match) return localizedMonthYear(match[1], match[2], locale, { slash: true });
  match = text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/u);
  if (match) return localizedMonthYear(parseMonthName(match[1]), match[2], locale, { slash: false });
  match = text.match(/^Tháng\s+(1[0-2]|[1-9])\s+(\d{4})$/u);
  if (match) return localizedMonthYear(match[1], match[2], locale, { slash: false });

  match = text.match(/^Chia đều\s+Tháng\s+(1[0-2]|[1-9])$/iu);
  if (match) return t("p1008.standardSplit", { month: localizedMonthOnly(match[1], locale) }, locale);
  match = text.match(/^Equal split for\s+(January|February|March|April|May|June|July|August|September|October|November|December)$/iu);
  if (match) return t("p1008.standardSplit", { month: localizedMonthOnly(parseMonthName(match[1]), locale) }, locale);

  match = text.match(/^Chưa có món nào trong\s+Tháng\s+(1[0-2]|[1-9])\/(\d{4})$/iu);
  if (match) return t("p1008.shopping.emptyTitle", { month: localizedMonthYear(match[1], match[2], locale, { slash: true }) }, locale);
  match = text.match(/^No items in\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/iu);
  if (match) return t("p1008.shopping.emptyTitle", { month: localizedMonthYear(parseMonthName(match[1]), match[2], locale, { slash: true }) }, locale);

  match = text.match(/^Tên món\s+(.+)$/u);
  if (match) return t("p1008.shopping.itemNameAria", { name: match[1] }, locale);
  match = text.match(/^Item name\s+(.+)$/u);
  if (match) return t("p1008.shopping.itemNameAria", { name: match[1] }, locale);
  match = text.match(/^Số tiền\s+(.+)$/u);
  if (match) return t("p1008.shopping.itemAmountAria", { name: match[1] }, locale);
  match = text.match(/^Amount for\s+(.+)$/u);
  if (match) return t("p1008.shopping.itemAmountAria", { name: match[1] }, locale);
  match = text.match(/^Số người chia\s+(.+)$/u);
  if (match) return t("p1008.shopping.itemSplitAria", { name: match[1] }, locale);
  match = text.match(/^Split count for\s+(.+)$/u);
  if (match) return t("p1008.shopping.itemSplitAria", { name: match[1] }, locale);
  match = text.match(/^Xóa món\s+[“"](.+)[”"]\?$/u);
  if (match) return t("p1008.shopping.deleteConfirm", { name: match[1] }, locale);
  match = text.match(/^Delete\s+[“"](.+)[”"]\?$/u);
  if (match) return t("p1008.shopping.deleteConfirm", { name: match[1] }, locale);

  match = text.match(/^(\d+)\s+saved\s+(word|words)$/iu);
  if (match) return t(Number(match[1]) === 1 ? "vocabulary.savedCountOne" : "vocabulary.savedCountMany", { count: match[1] }, locale);
  match = text.match(/^Đã lưu\s+(\d+)\s+từ$/iu);
  if (match) return t(Number(match[1]) === 1 ? "vocabulary.savedCountOne" : "vocabulary.savedCountMany", { count: match[1] }, locale);

  match = text.match(/^Translate into\s+(English|Vietnamese)$/iu);
  if (match) return t("vocabulary.translateInto", { language: localizedLanguageLabel(match[1], locale) }, locale);
  match = text.match(/^Dịch sang\s+(tiếng Anh|tiếng Việt)$/iu);
  if (match) return t("vocabulary.translateInto", { language: localizedLanguageLabel(match[1], locale) }, locale);

  match = text.match(/^Answer:\s*(.+)$/u);
  if (match) return t("vocabulary.answerValue", { value: match[1] }, locale);
  match = text.match(/^Đáp án:\s*(.+)$/u);
  if (match) return t("vocabulary.answerValue", { value: match[1] }, locale);

  match = text.match(/^(English|Tiếng Anh)\s*·\s*(.+)$/iu);
  if (match) return `${locale === "vi" ? "Tiếng Anh" : "English"} · ${match[2]}`;

  match = text.match(/^(Natural|Casual|Polite|Work)\s+English$/iu);
  if (match) return t("speaking.resultTone", { tone: localizedSpeakingTone(match[1], locale) }, locale);
  match = text.match(/^Tiếng Anh\s*·\s*(Tự nhiên|Thân mật|Lịch sự|Công việc)$/iu);
  if (match) return t("speaking.resultTone", { tone: localizedSpeakingTone(match[1], locale) }, locale);

  match = text.match(/^Stage\s+(\d+)\s+of\s+(\d+)$/iu);
  if (match) return t("projectHub.stageOf", { stage: match[1], total: match[2] }, locale);
  match = text.match(/^Stage\s+(\d+)\/(\d+)$/iu);
  if (match) return t("projectHub.stageOf", { stage: match[1], total: match[2] }, locale);

  match = text.match(/^(\d+)\s+commands$/iu);
  if (match) return t("projectHub.commandCount", { count: match[1] }, locale);
  match = text.match(/^(\d+)\s+lệnh$/iu);
  if (match) return t("projectHub.commandCount", { count: match[1] }, locale);

  match = text.match(/^Verified\s+(.+)$/u);
  if (match) return t("projectHub.verifiedDate", { date: match[1] }, locale);
  match = text.match(/^Đã xác minh\s+(.+)$/u);
  if (match) return t("projectHub.verifiedDate", { date: match[1] }, locale);

  match = text.match(/^(\d+)\s+recorded\s+(session|sessions)$/iu);
  if (match) return t(Number(match[1]) === 1 ? "projectHub.sessionCountOne" : "projectHub.sessionCountMany", { count: match[1] }, locale);
  match = text.match(/^(\d+)\s+buổi đã ghi$/iu);
  if (match) return t(Number(match[1]) === 1 ? "projectHub.sessionCountOne" : "projectHub.sessionCountMany", { count: match[1] }, locale);

  match = text.match(/^(\d+)\s+command\s+(block|blocks)\s+used$/iu);
  if (match) return t(Number(match[1]) === 1 ? "projectHub.commandBlockOne" : "projectHub.commandBlockMany", { count: match[1] }, locale);
  match = text.match(/^Đã dùng\s+(\d+)\s+khối lệnh$/iu);
  if (match) return t(Number(match[1]) === 1 ? "projectHub.commandBlockOne" : "projectHub.commandBlockMany", { count: match[1] }, locale);

  match = text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+deals$/u);
  if (match) {
    const month = parseMonthName(match[1]);
    return locale === "vi" ? `Giao dịch tháng ${month}` : `${MONTHS_EN_LONG[month - 1]} deals`;
  }
  match = text.match(/^Giao dịch tháng\s+(1[0-2]|[1-9])$/u);
  if (match) return locale === "vi" ? text : `${MONTHS_EN_LONG[Number(match[1]) - 1]} deals`;

  match = text.match(/^Delete\s+(.+)$/u);
  if (match) return locale === "vi" ? `Xóa ${match[1]}` : text;
  match = text.match(/^Xóa\s+(.+)$/u);
  if (match) return locale === "en" ? `Delete ${match[1]}` : text;

  const reminderPrefixes = [
    [LOCALES.en["saleAssistant.savedReminder"], "saleAssistant.savedReminder"],
    [LOCALES.vi["saleAssistant.savedReminder"], "saleAssistant.savedReminder"],
    [LOCALES.en["saleAssistant.savedTooClose"], "saleAssistant.savedTooClose"],
    [LOCALES.vi["saleAssistant.savedTooClose"], "saleAssistant.savedTooClose"],
  ];
  for (const [prefix, key] of reminderPrefixes) {
    if (text.startsWith(prefix)) return `${t(key, {}, locale)}${text.slice(prefix.length)}`;
  }

  return "";
}

export function translateText(value, locale = currentLocale) {
  const source = String(value ?? "");
  const text = source.trim();
  if (!text) return source;

  const key = keyForExactText(text, locale);
  if (key) return preserveWhitespace(source, t(key, {}, locale));

  const dynamic = dynamicTranslation(text, locale);
  return dynamic ? preserveWhitespace(source, dynamic) : source;
}

const USER_DATA_SKIP_SELECTOR = [
  "textarea",
  "input",
  "script",
  "style",
  "[contenteditable='true']",
  "[data-i18n-skip]",
  ".task-title",
  ".history-task-title",
  ".project-card .project-top > strong",
  ".project-card dl dd",
  ".sales-history-table tbody td:nth-child(2)",
  ".sales-history-table tbody td:nth-child(3)",
  ".sales-history-table tbody td:nth-child(4)",
  ".viewing-row > strong",
  ".viewing-row > span",
  ".sale-table tbody",
  ".room-share-detail-value",
  ".room-share-service-value",
  ".room-share-note-value",
  ".gmail-message .email-meta strong",
  ".gmail-message h3",
  ".gmail-message p",
  ".ielts-task-copy > strong",
  ".ielts-task-copy > small",
  ".ielts-course-list article > span > strong",
  ".ielts-course-list article > span > p",
  ".vocabulary-prompt",
  ".vocabulary-result-main strong",
  ".vocabulary-result-card dd",
  ".speaking-result-card p",
  ".hub-stage-heading h3",
  ".hub-stage-objective",
  ".hub-check-row > span:last-child",
  ".hub-completion-gate p",
  ".hub-result-card p",
  ".hub-command-card h3",
  ".hub-command-card > p",
  ".hub-command-card pre",
  ".hub-command-result p",
  ".hub-journal-card h3",
  ".hub-journal-card textarea",
  ".hub-open-issues li",
  ".hub-plan-card input",
  ".hub-plan-card textarea",
  ".hub-chat-message p",
].join(",");

function shouldSkipNode(node) {
  const parent = node?.parentElement;
  return !parent || Boolean(parent.closest(USER_DATA_SKIP_SELECTOR));
}

function translateTextNode(node) {
  if (shouldSkipNode(node)) return;
  const translated = translateText(node.nodeValue);
  if (translated !== node.nodeValue) node.nodeValue = translated;
}

function translateAttribute(element, name) {
  const value = element.getAttribute?.(name);
  if (!value) return;
  const translated = translateText(value);
  if (translated !== value) element.setAttribute(name, translated);
}

function translateElementAttributes(root) {
  const nodes = [];
  if (root?.nodeType === 1) nodes.push(root);
  root?.querySelectorAll?.("[placeholder], [aria-label], [title]").forEach((element) => nodes.push(element));
  nodes.forEach((element) => {
    translateAttribute(element, "placeholder");
    translateAttribute(element, "aria-label");
    translateAttribute(element, "title");
  });
}

function translateExplicitKeys(root) {
  const nodes = [];
  if (root?.nodeType === 1 && root.hasAttribute?.("data-i18n")) nodes.push(root);
  root?.querySelectorAll?.("[data-i18n]").forEach((element) => nodes.push(element));
  nodes.forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) return;
    const translated = t(key);
    if (element.textContent !== translated) element.textContent = translated;
  });
}

function applyFinanceMonths(root = document) {
  if (typeof document === "undefined") return;
  const labels = (root?.matches?.("#finance-months") ? root : null) || root?.querySelector?.("#finance-months") || document.querySelector("#finance-months");
  if (!labels) return;
  [...labels.children].forEach((label, index) => {
    if (index > 11) return;
    const next = currentLocale === "vi" ? `Thg ${index + 1}` : MONTHS_EN[index];
    if (label.textContent !== next) label.textContent = next;
  });
}

function vietnamHour() {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === "hour")?.value || new Date().getHours());
  } catch {
    return new Date().getHours();
  }
}

function setTextIfChanged(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

function applyHeaderLocale() {
  if (typeof document === "undefined") return;
  const today = document.querySelector("#today-label");
  if (today) {
    const value = new Intl.DateTimeFormat(getBrowserLocale(), {
      timeZone: "Asia/Ho_Chi_Minh",
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date());
    setTextIfChanged(today, value);
  }

  const greeting = document.querySelector("#greeting");
  if (!greeting) return;
  const name = document.querySelector(".profile-card strong")?.textContent?.trim() || "Vanh";
  const hour = vietnamHour();
  const key = hour < 12 ? "dashboard.goodMorning" : hour < 18 ? "dashboard.goodAfternoon" : "dashboard.goodEvening";
  const full = t(key, { name });
  const daypart = greeting.querySelector(".greeting-daypart");
  const namePart = greeting.querySelector(".greeting-name");
  if (daypart && namePart) {
    const separator = full.lastIndexOf(name);
    setTextIfChanged(daypart, separator >= 0 ? full.slice(0, separator).trim() : full);
    setTextIfChanged(namePart, separator >= 0 ? full.slice(separator).trim() : "");
  } else {
    setTextIfChanged(greeting, full);
  }
}

function applyPageMeta() {
  if (typeof document === "undefined") return;
  const path = window.location?.pathname || "";
  if (path.includes("login")) {
    document.title = t("meta.loginTitle");
    const meta = document.querySelector('meta[name="description"]');
    if (meta && meta.content !== t("meta.loginDescription")) meta.content = t("meta.loginDescription");
  } else if (path === "/" || path.endsWith("/index.html")) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta && meta.content !== t("meta.dashboardDescription")) meta.content = t("meta.dashboardDescription");
  }
}

function applyLocaleSpecificFormatting(root = document) {
  applyFinanceMonths(root);
  applyHeaderLocale();
  applyPageMeta();
}

function connectObserver() {
  if (!observer || !document?.body || observerConnected) return;
  observer.observe(document.body, OBSERVER_OPTIONS);
  observerConnected = true;
}

function pauseObserver() {
  if (!observer || !observerConnected) return false;
  observer.disconnect();
  observer.takeRecords?.();
  observerConnected = false;
  return true;
}

export function translateRoot(root = typeof document !== "undefined" ? document : null) {
  if (!root || translating) return;
  const reconnect = pauseObserver();
  translating = true;
  try {
    translateExplicitKeys(root);
    const walkerRoot = root.nodeType === 9 ? root.documentElement : root;
    if (walkerRoot) {
      const walker = document.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(translateTextNode);
    }
    translateElementAttributes(root.nodeType === 9 ? root.documentElement : root);
    if (root.nodeType === 9) applyLocaleSpecificFormatting(document);
  } finally {
    translating = false;
    if (reconnect) connectObserver();
  }
}

function normalizeScheduledRoot(root) {
  if (!root) return null;
  if (root.nodeType === 3) return root.parentElement;
  return root.nodeType === 1 ? root : null;
}

function queueRoot(root) {
  const normalized = normalizeScheduledRoot(root);
  if (!normalized || !normalized.isConnected) return;
  for (const existing of queuedRoots) {
    if (existing === normalized || existing.contains?.(normalized)) return;
    if (normalized.contains?.(existing)) queuedRoots.delete(existing);
  }
  queuedRoots.add(normalized);
}

function scheduleTranslate(root) {
  queueRoot(root);
  if (!queuedRoots.size || translationFrame || typeof window === "undefined") return;
  translationFrame = window.requestAnimationFrame(() => {
    translationFrame = 0;
    const roots = [...queuedRoots].filter((item) => item?.isConnected);
    queuedRoots = new Set();
    roots.forEach((item) => translateRoot(item));
  });
}

function installObserver() {
  if (typeof MutationObserver === "undefined" || !document?.body || observer) return;
  observer = new MutationObserver((mutations) => {
    if (translating) return;
    for (const mutation of mutations) {
      if (mutation.type === "characterData") scheduleTranslate(mutation.target);
      if (mutation.type === "attributes") scheduleTranslate(mutation.target);
      mutation.addedNodes?.forEach((node) => scheduleTranslate(node));
    }
  });
  connectObserver();
}

function settingsMarkup() {
  return `
    <section class="joy-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="joy-settings-title">
      <header class="joy-settings-header">
        <div><small>Hey Joy!</small><h2 id="joy-settings-title">${t("settings.title")}</h2><p>${t("settings.subtitle")}</p></div>
        <button type="button" class="joy-settings-close" data-joy-settings-close aria-label="${t("common.close")}">×</button>
      </header>
      <div class="joy-settings-body">
        <section class="joy-settings-section">
          <div class="joy-settings-section-copy"><strong>${t("settings.language")}</strong><p>${t("settings.languageHelp")}</p></div>
          <div class="joy-language-options" role="radiogroup" aria-label="${t("settings.language")}">
            ${SUPPORTED_LOCALES.map((locale) => `
              <button type="button" class="joy-language-option" data-joy-locale="${locale}" role="radio" aria-checked="${String(currentLocale === locale)}">
                <span><strong>${t(locale === "en" ? "settings.english" : "settings.vietnamese")}</strong><small>${t(locale === "en" ? "settings.englishHint" : "settings.vietnameseHint")}</small></span>
                <i aria-hidden="true"></i>
              </button>`).join("")}
          </div>
        </section>
      </div>
    </section>`;
}

function syncSettingsUi() {
  if (typeof document === "undefined") return;
  const backdrop = document.querySelector("#joy-settings-backdrop");
  if (backdrop) backdrop.innerHTML = settingsMarkup();
  document.querySelectorAll("[data-joy-settings-open]").forEach((button) => {
    button.setAttribute("aria-label", t("settings.open"));
    button.setAttribute("title", t("settings.open"));
    const label = button.querySelector("[data-joy-settings-label]");
    if (label) setTextIfChanged(label, t("settings.open"));
  });
  const avatar = document.querySelector(".header-avatar");
  if (avatar) avatar.setAttribute("aria-label", `${t("dashboard.profile")} · ${t("settings.open")}`);
}

export function openSettings() {
  if (typeof document === "undefined") return;
  const backdrop = document.querySelector("#joy-settings-backdrop");
  if (!backdrop) return;
  syncSettingsUi();
  backdrop.hidden = false;
  document.body.classList.add("joy-settings-open");
  backdrop.querySelector("[data-joy-settings-close]")?.focus();
}

export function closeSettings() {
  if (typeof document === "undefined") return;
  const backdrop = document.querySelector("#joy-settings-backdrop");
  if (!backdrop) return;
  backdrop.hidden = true;
  document.body.classList.remove("joy-settings-open");
}

function installSettingsUi() {
  if (typeof document === "undefined" || !document.body) return;

  if (!document.querySelector("#joy-settings-backdrop")) {
    const backdrop = document.createElement("div");
    backdrop.id = "joy-settings-backdrop";
    backdrop.className = "joy-settings-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = settingsMarkup();
    document.body.append(backdrop);
  }

  const footer = document.querySelector(".sidebar-footer");
  if (footer && !footer.querySelector("[data-joy-settings-open]")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "joy-settings-trigger";
    button.dataset.joySettingsOpen = "true";
    button.innerHTML = `<span aria-hidden="true">⚙</span><span data-joy-settings-label>${t("settings.open")}</span>`;
    footer.prepend(button);
  }

  const saleProfile = document.querySelector(".sale-profile");
  if (saleProfile && !saleProfile.parentElement?.querySelector("[data-joy-settings-open]")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "joy-settings-trigger joy-settings-trigger-sale";
    button.dataset.joySettingsOpen = "true";
    button.innerHTML = `<span aria-hidden="true">⚙</span><span data-joy-settings-label>${t("settings.open")}</span>`;
    saleProfile.insertAdjacentElement("beforebegin", button);
  }

  const avatar = document.querySelector(".header-avatar");
  if (avatar && avatar.dataset.joySettingsBound !== "true") {
    avatar.dataset.joySettingsBound = "true";
    avatar.setAttribute("role", "button");
    avatar.setAttribute("tabindex", "0");
    avatar.addEventListener("click", openSettings);
    avatar.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSettings();
      }
    });
  }

  syncSettingsUi();
}

export function setLocale(locale, { persist = true } = {}) {
  if (!SUPPORTED_LOCALES.includes(locale)) return currentLocale;
  const changed = locale !== currentLocale;
  currentLocale = locale;
  if (persist) writeStoredLocale(locale);
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    translateRoot(document);
    const reconnect = pauseObserver();
    try {
      syncSettingsUi();
    } finally {
      if (reconnect) connectObserver();
    }
  }
  if (changed && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("joy:locale-changed", { detail: { locale } }));
  }
  return currentLocale;
}

function installEvents() {
  if (typeof document === "undefined") return;
  document.addEventListener("click", (event) => {
    const language = event.target.closest?.("[data-joy-locale]");
    if (language) {
      setLocale(language.dataset.joyLocale);
      return;
    }
    if (event.target.closest?.("[data-joy-settings-open]")) {
      openSettings();
      return;
    }
    if (event.target.closest?.("[data-joy-settings-close]")) {
      closeSettings();
      return;
    }
    if (event.target.id === "joy-settings-backdrop") closeSettings();
  });

  document.addEventListener("click", (event) => {
    const legacySettings = event.target.closest?.('[data-action="sample-settings"]');
    if (!legacySettings) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openSettings();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.querySelector("#joy-settings-backdrop")?.hidden) closeSettings();
  });

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY && SUPPORTED_LOCALES.includes(event.newValue)) {
        setLocale(event.newValue, { persist: false });
      }
    });
  }
}

export function install() {
  if (typeof document === "undefined" || !document.documentElement) return;
  if (document.documentElement.dataset.joyI18n === "true") return;
  document.documentElement.dataset.joyI18n = "true";
  document.documentElement.lang = currentLocale;
  installSettingsUi();
  installEvents();
  translateRoot(document);
  installObserver();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("joy:i18n-ready", { detail: { locale: currentLocale } }));
  }
}

export function validateLocaleParity() {
  const enKeys = Object.keys(en).sort();
  const viKeys = Object.keys(vi).sort();
  const missingInVi = enKeys.filter((key) => !Object.prototype.hasOwnProperty.call(vi, key));
  const missingInEn = viKeys.filter((key) => !Object.prototype.hasOwnProperty.call(en, key));
  const placeholderMismatches = enKeys.filter((key) => {
    if (!Object.prototype.hasOwnProperty.call(vi, key)) return false;
    return JSON.stringify(placeholders(en[key])) !== JSON.stringify(placeholders(vi[key]));
  });
  return { missingInVi, missingInEn, placeholderMismatches };
}

if (typeof window !== "undefined") {
  window.JoyI18n = Object.freeze({
    t,
    getLocale,
    setLocale,
    getBrowserLocale,
    formatDate,
    formatNumber,
    formatCurrency,
    translateText,
    translateRoot,
    openSettings,
    closeSettings,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
}
