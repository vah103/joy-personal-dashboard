import { formatRoomSummarySource } from "./formatter.js";

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

export function renderPassThroughRoomSummary(doc, output, source) {
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

export function createPassThroughSummary(doc) {
  const input = doc.querySelector("#room-summary-input");
  const output = doc.querySelector("#room-summary-card");
  const capture = doc.querySelector("#room-summary-capture-button");
  if (!input || !output || !capture) return false;
  const hasContent = renderPassThroughRoomSummary(doc, output, input.value);
  capture.disabled = !hasContent;
  if (hasContent) output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return true;
}

export function openPassThroughCapture(doc) {
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
