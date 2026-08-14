const ROOM_SUMMARY_AI_PATH = "/api/sales/room-summary/extract";

function editableValue(text) {
  const value = document.createElement("span");
  value.className = "room-share-detail-value";
  value.textContent = text;
  value.contentEditable = "true";
  value.spellcheck = false;
  return value;
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
  const detail = document.createElement("p");
  detail.textContent = "Dán tin phòng rồi tạo một bản gọn để gửi khách.";
  empty.append(mark, title, detail);
  container.append(empty);
}

function appendAddress(details, address) {
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.textContent = "Địa chỉ";
  row.append(label, document.createTextNode(": "), editableValue(address || "Không xác định"));
  details.append(row);
}

function appendRoomList(details, rooms) {
  if (!rooms.length) return;

  const group = document.createElement("div");
  group.className = "room-share-room-pricing room-share-room-pricing-multi";
  const list = document.createElement("ul");
  list.className = "room-share-price-list";

  rooms.forEach((room) => {
    const item = document.createElement("li");
    const roomValue = editableValue(room.room || "—");
    roomValue.classList.add("room-share-price-value");
    item.append(roomValue);

    if (room.price) {
      item.append(document.createTextNode(" · "), editableValue(room.price));
    }
    if (room.availability) {
      item.append(document.createTextNode(" · "), editableValue(room.availability));
    }

    list.append(item);
  });

  group.append(list);
  details.append(group);
}

function renderSummary(container, summary = {}) {
  container.replaceChildren();
  container.classList.remove("is-empty");

  const details = document.createElement("div");
  details.className = "room-share-details";
  appendAddress(details, summary.address);
  appendRoomList(details, Array.isArray(summary.rooms) ? summary.rooms : []);
  container.append(details);
}

async function detectRoomSummary(source) {
  const response = await fetch(ROOM_SUMMARY_AI_PATH, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.error || "ROOM_SUMMARY_AI_FAILED"), {
      code: payload.error || "ROOM_SUMMARY_AI_FAILED",
    });
  }

  const rooms = Array.isArray(payload.rooms)
    ? payload.rooms.map((room) => ({
      room: String(room?.room || "").trim(),
      price: String(room?.price || "").trim(),
      availability: String(room?.availability || "").trim(),
    })).filter((room) => room.room || room.price || room.availability)
    : [];

  return {
    address: String(payload.address || "").trim(),
    rooms,
  };
}

function initializeRoomAddressAi() {
  const input = document.querySelector("#room-summary-input");
  const output = document.querySelector("#room-summary-card");
  const generate = document.querySelector("#room-summary-generate");
  const clear = document.querySelector("#room-summary-clear");
  const capture = document.querySelector("#room-summary-capture-button");
  const captureLayer = document.querySelector("#room-summary-capture");
  const captureCard = document.querySelector("#room-summary-capture-card");
  if (!input || !output || !generate || !clear || !capture || !captureLayer || !captureCard) return;

  let requestVersion = 0;
  renderEmpty(output);
  capture.disabled = true;

  const createSummary = async () => {
    const source = input.value.trim();
    if (!source) {
      requestVersion += 1;
      renderEmpty(output);
      capture.disabled = true;
      input.focus();
      return;
    }

    const version = ++requestVersion;
    generate.disabled = true;
    generate.textContent = "Đang kiểm tra…";
    capture.disabled = true;
    renderSummary(output, { address: "…", rooms: [] });

    try {
      const summary = await detectRoomSummary(source);
      if (version !== requestVersion) return;
      renderSummary(output, {
        address: summary.address || "Không xác định",
        rooms: summary.rooms,
      });
      capture.disabled = false;
      output.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      if (version !== requestVersion) return;
      console.warn("Joy Sale room summary detection failed", error?.code || error?.message || error);
      renderSummary(output, { address: "Không xác định", rooms: [] });
      capture.disabled = true;
    } finally {
      if (version === requestVersion) {
        generate.disabled = false;
        generate.textContent = "Create summary";
      }
    }
  };

  generate.addEventListener("click", createSummary);
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") createSummary();
  });

  clear.addEventListener("click", () => {
    requestVersion += 1;
    input.value = "";
    generate.disabled = false;
    generate.textContent = "Create summary";
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeRoomAddressAi, { once: true });
} else {
  initializeRoomAddressAi();
}
