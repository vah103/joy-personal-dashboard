export function prepareRoomDisplayText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
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

function renderText(container, text) {
  container.replaceChildren();
  container.classList.remove("is-empty");

  const body = document.createElement("div");
  body.className = "room-share-plain-text";
  body.textContent = text;
  body.contentEditable = "true";
  body.spellcheck = false;
  body.style.whiteSpace = "pre-wrap";
  body.style.overflowWrap = "anywhere";
  body.style.font = "inherit";
  body.style.fontSize = "16px";
  body.style.lineHeight = "1.65";
  container.append(body);
}

function initializeRoomComposer() {
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
