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

function normalizeRoomSummarySource(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ ]{2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatRoomSummarySource(value) {
  const source = normalizeRoomSummarySource(value);
  if (!source) return [];

  const blocks = [];
  for (const line of source.split("\n")) {
    if (!line) continue;

    const labeled = line.match(/^([^:：\n]{1,48})\s*[:：]\s*(.*)$/u);
    if (labeled) {
      const label = labeled[1].trim();
      const detail = labeled[2].trim();
      blocks.push(detail
        ? { type: "field", label, value: detail }
        : { type: "heading", label });
      continue;
    }

    const bullet = line.match(/^[+\-–—•·*]\s*(.+)$/u);
    if (bullet) {
      blocks.push({ type: "bullet", value: bullet[1].trim() });
      continue;
    }

    blocks.push({ type: "text", value: line });
  }
  return blocks;
}

function editableRoomValue(doc, className, value) {
  const span = doc.createElement("span");
  span.className = className;
  span.textContent = value;
  span.contentEditable = "true";
  span.spellcheck = false;
  return span;
}

function appendPassThroughField(doc, container, block) {
  const row = doc.createElement("p");
  row.className = "room-share-detail-row room-share-pass-through-field";
  const label = doc.createElement("strong");
  label.textContent = `${block.label}:`;
  row.append(label, doc.createTextNode(" "), editableRoomValue(doc, "room-share-detail-value", block.value));
  container.append(row);
}

function appendPassThroughHeading(doc, container, block) {
  const heading = doc.createElement("h4");
  heading.className = "room-share-section-title room-share-pass-through-title";
  heading.textContent = `${block.label}:`;
  container.append(heading);
}

function appendPassThroughText(doc, container, block) {
  const row = doc.createElement("p");
  row.className = "room-share-detail-row room-share-pass-through-text";
  row.append(editableRoomValue(doc, "room-share-detail-value", block.value));
  container.append(row);
}

function appendPassThroughBullets(doc, container, blocks, startIndex) {
  const list = doc.createElement("ul");
  list.className = "room-share-notes room-share-pass-through-list";
  let index = startIndex;
  while (index < blocks.length && blocks[index].type === "bullet") {
    const item = doc.createElement("li");
    item.append(editableRoomValue(doc, "room-share-note-value", blocks[index].value));
    list.append(item);
    index += 1;
  }
  container.append(list);
  return index;
}

function renderPassThroughRoomSummary(doc, output, source) {
  const blocks = formatRoomSummarySource(source);
  output.replaceChildren();
  output.classList.toggle("is-empty", !blocks.length);
  output.dataset.roomSummaryMode = "pass-through";
  if (!blocks.length) return false;

  const content = doc.createElement("div");
  content.className = "room-share-details room-share-pass-through";
  for (let index = 0; index < blocks.length;) {
    const block = blocks[index];
    if (block.type === "field") appendPassThroughField(doc, content, block);
    else if (block.type === "heading") appendPassThroughHeading(doc, content, block);
    else if (block.type === "text") appendPassThroughText(doc, content, block);
    else if (block.type === "bullet") {
      index = appendPassThroughBullets(doc, content, blocks, index);
      continue;
    }
    index += 1;
  }
  output.append(content);
  return true;
}

function createPassThroughSummary(doc) {
  const input = doc.querySelector("#room-summary-input");
  const output = doc.querySelector("#room-summary-card");
  const capture = doc.querySelector("#room-summary-capture-button");
  if (!input || !output || !capture) return false;
  const hasContent = renderPassThroughRoomSummary(doc, output, input.value);
  capture.disabled = !hasContent;
  if (hasContent) output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return true;
}

function openPassThroughCapture(doc) {
  const output = doc.querySelector("#room-summary-card");
  const captureLayer = doc.querySelector("#room-summary-capture");
  const captureCard = doc.querySelector("#room-summary-capture-card");
  if (!output || !captureLayer || !captureCard || output.classList.contains("is-empty")) return false;
  const clone = output.cloneNode(true);
  clone.removeAttribute("id");
  clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
  captureCard.replaceChildren(clone);
  captureLayer.hidden = false;
  doc.body.classList.add("sale-room-capture-open");
  return true;
}

function installRoomSummaryPassThrough(doc = globalThis.document) {
  if (!doc?.documentElement || doc.documentElement.dataset.roomSummaryPassThrough === "true") return;
  doc.documentElement.dataset.roomSummaryPassThrough = "true";

  doc.addEventListener("click", (event) => {
    if (event.target.closest?.("#room-summary-generate")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      createPassThroughSummary(doc);
      return;
    }
    if (event.target.closest?.("#room-summary-capture-button")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openPassThroughCapture(doc);
    }
  }, true);

  doc.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
    if (!event.target?.matches?.("#room-summary-input")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    createPassThroughSummary(doc);
  }, true);
}

export async function installSaleEnglishUi(doc = globalThis.document) {
  if (!doc?.body || doc.body.dataset.saleLanguageAdapter === "true") return;
  doc.body.dataset.saleLanguageAdapter = "true";
  ensureI18nStyle(doc);
  installRoomSummaryPassThrough(doc);

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
