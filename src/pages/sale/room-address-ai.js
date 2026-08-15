export function prepareRoomDisplayText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function ensureRoomSummaryFormatStyle(doc = globalThis.document) {
  if (!doc?.head || doc.querySelector("#room-summary-format-style")) return;

  const style = doc.createElement("style");
  style.id = "room-summary-format-style";
  style.textContent = `
    .room-share-rich-text {
      color: #172126;
      font-size: 16px;
      line-height: 1.62;
      outline: 0;
      overflow-wrap: anywhere;
    }
    .room-share-rich-text > * { margin: 0; }
    .room-share-format-label {
      color: #142b34;
      font-weight: 800;
    }
    .room-share-format-field {
      font-size: 16px;
      line-height: 1.58;
    }
    .room-share-format-field + .room-share-format-field { margin-top: 7px; }
    .room-share-format-field.is-spaced { margin-top: 21px; }
    .room-share-format-section {
      margin-top: 25px;
      color: #1d3c46;
      font-size: 17px;
      font-weight: 850;
      line-height: 1.35;
    }
    .room-share-rich-text > .room-share-format-section:first-child { margin-top: 0; }
    .room-share-format-list {
      margin-top: 9px;
      padding-left: 22px;
      color: #172126;
    }
    .room-share-format-list.is-spaced { margin-top: 10px; }
    .room-share-format-list li {
      margin: 7px 0;
      padding-left: 3px;
      line-height: 1.55;
    }
    .room-share-format-paragraph {
      margin-top: 8px;
      line-height: 1.58;
    }
    .room-share-format-paragraph.is-spaced { margin-top: 20px; }
    .room-share-rich-text[contenteditable="true"]:focus { outline: 0; }
    @media (max-width: 700px) {
      .room-share-rich-text { font-size: 15px; line-height: 1.58; }
      .room-share-format-field { font-size: 15px; }
      .room-share-format-section { margin-top: 22px; font-size: 16px; }
      .room-share-format-field.is-spaced { margin-top: 18px; }
      .room-share-format-list { padding-left: 20px; }
      .room-share-format-list li { margin: 6px 0; }
    }
  `;
  doc.head.append(style);
}

function splitLabeledLine(value) {
  const line = String(value ?? "").trim();
  const colon = line.indexOf(":");
  if (colon <= 0) return null;

  const label = line.slice(0, colon).trim();
  const content = line.slice(colon + 1).trim();
  if (!label || label.length > 60) return null;
  return { label, value: content };
}

function parseListItem(value) {
  const text = String(value ?? "").trim();
  const labeled = splitLabeledLine(text);
  return labeled?.value
    ? { label: labeled.label, value: labeled.value }
    : { label: "", value: text };
}

export function parseRoomDisplayBlocks(value) {
  const text = prepareRoomDisplayText(value);
  if (!text) return [];

  const blocks = [];
  let listItems = [];
  let listSpaced = false;
  let blankBeforeNext = false;

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: "list", items: listItems, spaced: listSpaced });
    listItems = [];
    listSpaced = false;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      blankBeforeNext = true;
      continue;
    }

    const bullet = line.match(/^[*•-]\s+(.+)$/u);
    if (bullet) {
      if (!listItems.length) listSpaced = blankBeforeNext;
      listItems.push(parseListItem(bullet[1]));
      blankBeforeNext = false;
      continue;
    }

    flushList();

    const labeled = splitLabeledLine(line);
    if (labeled && !labeled.value) {
      blocks.push({
        type: "section",
        title: labeled.label,
        spaced: blankBeforeNext,
      });
    } else if (labeled) {
      blocks.push({
        type: "field",
        label: labeled.label,
        value: labeled.value,
        spaced: blankBeforeNext,
      });
    } else {
      blocks.push({
        type: "paragraph",
        text: line,
        spaced: blankBeforeNext,
      });
    }

    blankBeforeNext = false;
  }

  flushList();
  return blocks;
}

function renderEmpty(container) {
  container.replaceChildren();
  container.classList.add("is-empty");

  const empty = document.createElement("div");
  empty.className = "room-share-empty";

  const mark = document.createElement("span");
  mark.textContent = "⌂";

  const title = document.createElement("strong");
  title.textContent = "Bản tóm tắt phòng sẽ hiện ở đây";

  empty.append(mark, title);
  container.append(empty);
}

function appendLabeledContent(target, label, value) {
  const strong = document.createElement("strong");
  strong.className = "room-share-format-label";
  strong.textContent = `${label}:`;
  target.append(strong, document.createTextNode(" "), document.createTextNode(value));
}

function applySpacingClass(element, spaced) {
  if (spaced) element.classList.add("is-spaced");
  return element;
}

function renderBlock(body, block) {
  if (block.type === "section") {
    const heading = applySpacingClass(document.createElement("h3"), block.spaced);
    heading.classList.add("room-share-format-section");
    heading.textContent = block.title;
    body.append(heading);
    return;
  }

  if (block.type === "field") {
    const row = applySpacingClass(document.createElement("p"), block.spaced);
    row.classList.add("room-share-format-field");
    appendLabeledContent(row, block.label, block.value);
    body.append(row);
    return;
  }

  if (block.type === "list") {
    const list = applySpacingClass(document.createElement("ul"), block.spaced);
    list.classList.add("room-share-format-list");
    block.items.forEach((entry) => {
      const item = document.createElement("li");
      if (entry.label) appendLabeledContent(item, entry.label, entry.value);
      else item.textContent = entry.value;
      list.append(item);
    });
    body.append(list);
    return;
  }

  const paragraph = applySpacingClass(document.createElement("p"), block.spaced);
  paragraph.classList.add("room-share-format-paragraph");
  paragraph.textContent = block.text;
  body.append(paragraph);
}

function renderText(container, text) {
  container.replaceChildren();
  container.classList.remove("is-empty");

  const body = document.createElement("div");
  body.className = "room-share-rich-text";
  body.contentEditable = "true";
  body.spellcheck = false;

  const blocks = parseRoomDisplayBlocks(text);
  if (!blocks.length) {
    body.textContent = text;
    body.style.whiteSpace = "pre-wrap";
  } else {
    blocks.forEach((block) => renderBlock(body, block));
  }
  container.append(body);
}

function initializeRoomComposer() {
  document.querySelector("#room-summary-chatgpt")?.remove();
  ensureRoomSummaryFormatStyle(document);

  const input = document.querySelector("#room-summary-input");
  const output = document.querySelector("#room-summary-card");
  const generate = document.querySelector("#room-summary-generate");
  const clear = document.querySelector("#room-summary-clear");
  const capture = document.querySelector("#room-summary-capture-button");
  const captureLayer = document.querySelector("#room-summary-capture");
  const captureCard = document.querySelector("#room-summary-capture-card");
  if (!input || !output || !generate || !clear || !capture || !captureLayer || !captureCard) return;

  renderEmpty(output);
  capture.disabled = true;

  const createSummary = () => {
    const text = prepareRoomDisplayText(input.value);
    if (!text) {
      renderEmpty(output);
      capture.disabled = true;
      input.focus();
      return;
    }

    renderText(output, text);
    capture.disabled = false;
    output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  generate.addEventListener("click", createSummary);
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") createSummary();
  });

  clear.addEventListener("click", () => {
    input.value = "";
    renderEmpty(output);
    capture.disabled = true;
    input.focus();
  });

  capture.addEventListener("click", () => {
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeRoomComposer, { once: true });
  } else {
    initializeRoomComposer();
  }
}
