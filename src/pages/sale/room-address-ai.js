const ROOM_SUMMARY_AI_PATH = "/api/sales/room-summary/extract";

function normalizeRoomCodeForDisplay(value) {
  const source = String(value ?? "").trim();
  if (!source) return "";

  const withoutLabel = source.replace(/^(?:phòng|phong|room)\s*[:#-]?\s*/iu, "");
  const match = withoutLabel.match(/^p?\s*[-:]?\s*(\d{1,4})$/iu);
  return match ? `P${match[1]}` : source;
}

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

function appendRoomFacts(target, room) {
  const roomValue = editableValue(room.room || "—");
  roomValue.classList.add("room-share-price-value");
  target.append(roomValue);

  if (room.price) {
    target.append(document.createTextNode(" · "), editableValue(room.price));
  }
  if (room.availability) {
    target.append(document.createTextNode(" · "), editableValue(room.availability));
  }
}

function appendSingleRoom(details, room) {
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.append("Phòng");
  row.append(label, document.createTextNode(": "));
  appendRoomFacts(row, room);
  details.append(row);
}

function appendMultipleRooms(details, rooms) {
  const group = document.createElement("div");
  group.className = "room-share-room-pricing room-share-room-pricing-multi";

  const heading = document.createElement("p");
  heading.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.append("Phòng");
  heading.append(label, document.createTextNode(":"));

  const list = document.createElement("ul");
  list.className = "room-share-price-list";
  rooms.forEach((room) => {
    const item = document.createElement("li");
    appendRoomFacts(item, room);
    list.append(item);
  });

  group.append(heading, list);
  details.append(group);
}

function appendRooms(details, rooms) {
  if (!rooms.length) return;
  if (rooms.length === 1) {
    appendSingleRoom(details, rooms[0]);
    return;
  }
  appendMultipleRooms(details, rooms);
}

function appendRoomType(details, roomType) {
  if (!roomType) return;
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.append("Dạng", " phòng");
  row.append(label, document.createTextNode(": "), editableValue(roomType));
  details.append(row);
}

function renderSummary(container, summary = {}) {
  container.replaceChildren();
  container.classList.remove("is-empty");

  const details = document.createElement("div");
  details.className = "room-share-details";
  appendAddress(details, summary.address);
  appendRooms(details, Array.isArray(summary.rooms) ? summary.rooms : []);
  appendRoomType(details, summary.roomType);
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
      room: normalizeRoomCodeForDisplay(room?.room),
      price: String(room?.price || "").trim(),
      availability: String(room?.availability || "").trim(),
    })).filter((room) => room.room || room.price || room.availability)
    : [];

  return {
    address: String(payload.address || "").trim(),
    rooms,
    roomType: String(payload.roomType || "").trim(),
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
    renderSummary(output, { address: "…", rooms: [], roomType: "" });

    try {
      const summary = await detectRoomSummary(source);
      if (version !== requestVersion) return;
      renderSummary(output, {
        address: summary.address || "Không xác định",
        rooms: summary.rooms,
        roomType: summary.roomType,
      });
      capture.disabled = false;
      output.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      if (version !== requestVersion) return;
      console.warn("Joy Sale room summary detection failed", error?.code || error?.message || error);
      renderSummary(output, { address: "Không xác định", rooms: [], roomType: "" });
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
