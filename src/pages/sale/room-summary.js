const LEADING_LABEL_PATTERN = /^([\p{L}][^:\n]*:)(.*)$/u;

export function summarizeRoomListing(rawInput) {
  const text = String(rawInput ?? "").replace(/\r\n?/g, "\n");
  return {
    text,
    lines: text.split("\n"),
    isEmpty: !text.trim(),
  };
}

export function formatRoomSummaryDisplayLine(line) {
  const value = String(line ?? "");
  if (value === "*" || /^\*\s/u.test(value)) return `•${value.slice(1)}`;
  return value;
}

export function splitRoomSummaryLine(line) {
  const value = String(line ?? "");
  const match = value.match(LEADING_LABEL_PATTERN);
  if (!match) return { label: "", rest: value };
  return { label: match[1], rest: match[2] };
}

function renderEmptyRoomSummary(container) {
  const empty = document.createElement("div");
  empty.className = "room-share-empty";
  const mark = document.createElement("span");
  mark.textContent = "⌂";
  const title = document.createElement("strong");
  title.textContent = "Your room summary will appear here";
  const detail = document.createElement("p");
  detail.textContent = "Paste a room listing, then create a clean customer view.";
  empty.append(mark, title, detail);
  container.append(empty);
}

function renderRoomSummaryLine(line, editable) {
  const row = document.createElement("p");
  row.className = "room-share-detail-row room-share-plain-line";
  row.contentEditable = String(editable);
  row.spellcheck = false;

  const displayLine = formatRoomSummaryDisplayLine(line);
  if (!displayLine) {
    row.append(document.createElement("br"));
    return row;
  }

  const { label, rest } = splitRoomSummaryLine(displayLine);
  if (!label) {
    row.textContent = displayLine;
    return row;
  }

  const strong = document.createElement("strong");
  strong.textContent = label;
  row.append(strong, document.createTextNode(rest));
  return row;
}

export function renderRoomSummary(container, summary, { editable = true } = {}) {
  container.dataset.i18nSkip = "true";
  container.replaceChildren();
  container.classList.toggle("is-empty", summary.isEmpty);

  if (summary.isEmpty) {
    renderEmptyRoomSummary(container);
    return;
  }

  const body = document.createElement("div");
  body.className = "room-share-plain-text";
  for (const line of summary.lines) body.append(renderRoomSummaryLine(line, editable));
  container.append(body);
}

function initializeRoomSummary() {
  const input = document.querySelector("#room-summary-input");
  const output = document.querySelector("#room-summary-card");
  const generate = document.querySelector("#room-summary-generate");
  const clear = document.querySelector("#room-summary-clear");
  const capture = document.querySelector("#room-summary-capture-button");
  const captureLayer = document.querySelector("#room-summary-capture");
  const captureCard = document.querySelector("#room-summary-capture-card");
  if (!input || !output || !generate || !clear || !capture || !captureLayer || !captureCard) return;

  let current = summarizeRoomListing("");
  renderRoomSummary(output, current);

  const createSummary = () => {
    current = summarizeRoomListing(input.value);
    renderRoomSummary(output, current);
    capture.disabled = current.isEmpty;
    output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  generate.addEventListener("click", createSummary);
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") createSummary();
  });

  clear.addEventListener("click", () => {
    input.value = "";
    current = summarizeRoomListing("");
    renderRoomSummary(output, current);
    capture.disabled = true;
    input.focus();
  });

  capture.addEventListener("click", () => {
    if (current.isEmpty) return;
    const clone = output.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
    captureCard.replaceChildren(clone);
    captureLayer.hidden = false;
    document.body.classList.add("sale-room-capture-open");
  });

  captureLayer.addEventListener("click", () => {
    captureLayer.hidden = true;
    document.body.classList.remove("sale-room-capture-open");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !captureLayer.hidden) {
      captureLayer.hidden = true;
      document.body.classList.remove("sale-room-capture-open");
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeRoomSummary, { once: true });
  else initializeRoomSummary();
}
