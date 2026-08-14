const ROOM_SUMMARY_AI_PATH = "/api/sales/room-summary/extract";
const ROOM_SUMMARY_REQUEST_TIMEOUT_MS = 20000;

function normalizeRoomCodeForDisplay(value) {
  const source = String(value ?? "").trim();
  if (!source) return "";

  const withoutLabel = source.replace(/^(?:phòng|phong|room)\s*[:#-]?\s*/iu, "");
  const match = withoutLabel.match(/^p?\s*[-:]?\s*(\d{1,4})$/iu);
  return match ? `P${match[1]}` : source;
}

function roomValueIsFloorOnly(sourceValue, roomValue) {
  const room = String(roomValue ?? "").trim();
  if (!/^\d{1,2}$/u.test(room)) return false;

  const escaped = room.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const floorPattern = new RegExp(`(?:phòng\\s+)?tầng\\s*[:#-]?\\s*${escaped}\\b`, "iu");
  if (!floorPattern.test(String(sourceValue ?? ""))) return false;

  const explicitRoomPattern = new RegExp(`(?:phòng|room)\\s*[:#-]?\\s*${escaped}\\b|\\bp\\s*[-:]?\\s*${escaped}\\b`, "iu");
  return !explicitRoomPattern.test(String(sourceValue ?? ""));
}

function normalizeFurnitureForDisplay(value) {
  const items = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const key = item
        .toLocaleLowerCase("vi")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "")
        .trim();
      if (key === "dh") return "điều hòa";
      if (key === "nl") return "nóng lạnh";
      return item.toLocaleLowerCase("vi");
    });

  if (!items.length) return "";
  const joined = items.join(", ");
  return joined.charAt(0).toLocaleUpperCase("vi") + joined.slice(1);
}

function normalizeServiceRateForDisplay(value, serviceKind) {
  let clean = String(value ?? "")
    .trim()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\bK\b/g, "k");

  if (serviceKind === "electricity") {
    clean = clean
      .replace(/\/(?:1\s*)?(?:số|so)$/iu, "/số")
      .replace(/\/kwh$/iu, "/số")
      .replace(/^3[.,]99(?:0)?(?=\/|$)/u, "4k");
  }

  if (serviceKind === "water") {
    clean = clean
      .replace(/\/(?:ng|người|nguoi)$/iu, "/người")
      .replace(/\/(?:m3|m³|khối|khoi)$/iu, "/khối");
  }

  return clean;
}

function dynamicServiceItemsForDisplay(items) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  return items.map((item) => ({
    kind: String(item?.kind || "").trim(),
    name: String(item?.name || "").trim(),
    value: String(item?.value || "").trim(),
    includes: Array.isArray(item?.includes)
      ? item.includes.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
  })).filter((item) => {
    if (!item.name || !item.value) return false;
    const identity = `${item.kind}|${item.name.toLocaleLowerCase("vi")}|${item.value.toLocaleLowerCase("vi")}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function servicesForDisplay(_sourceValue, services = {}) {
  const electricity = normalizeServiceRateForDisplay(services?.electricity, "electricity");
  const water = normalizeServiceRateForDisplay(services?.water, "water");
  const items = dynamicServiceItemsForDisplay(services?.items);
  return { electricity, water, items };
}

function extractFloorForDisplay(sourceValue, rooms = []) {
  if (rooms.some((room) => room?.room)) return "";

  const floors = new Set();
  const source = String(sourceValue ?? "");
  for (const match of source.matchAll(/(?:^|[\s,;:.(\[-])(?:phòng\s+)?tầng\s*[:#-]?\s*(\d{1,2})(?=$|[\s,;:.)\]-])/giu)) {
    floors.add(String(Number(match[1])));
  }
  return floors.size === 1 ? [...floors][0] : "";
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

function appendPriceAndAvailability(target, room) {
  if (room.price) {
    target.append(document.createTextNode(" · "), editableValue(room.price));
  }
  if (room.availability) {
    target.append(document.createTextNode(" · "), editableValue(room.availability));
  }
}

function appendRoomFacts(target, room) {
  const roomValue = editableValue(room.room);
  roomValue.classList.add("room-share-price-value");
  target.append(roomValue);
  appendPriceAndAvailability(target, room);
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

function appendLabeledValue(details, labelParts, value) {
  if (!value) return;
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.append(...labelParts);
  row.append(label, document.createTextNode(": "), editableValue(value));
  details.append(row);
}

function appendFloorFacts(details, floor, room = {}) {
  if (!floor) return;
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.append("T", "ầng");
  row.append(label, document.createTextNode(": "), editableValue(floor));
  appendPriceAndAvailability(row, room);
  details.append(row);
}

function uniqueFact(rooms, key) {
  const values = [...new Set(rooms.map((room) => String(room?.[key] || "").trim()).filter(Boolean))];
  return values.length === 1 ? values[0] : "";
}

function appendRooms(details, rooms, floor = "") {
  const codedRooms = rooms.filter((room) => room.room);
  if (codedRooms.length === 1) {
    appendSingleRoom(details, codedRooms[0]);
    return;
  }
  if (codedRooms.length > 1) {
    appendMultipleRooms(details, codedRooms);
    return;
  }

  const roomlessFacts = {
    price: uniqueFact(rooms, "price"),
    availability: uniqueFact(rooms, "availability"),
  };

  if (floor) {
    appendFloorFacts(details, floor, roomlessFacts);
    return;
  }

  appendLabeledValue(details, ["G", "iá"], roomlessFacts.price);
  appendLabeledValue(details, ["T", "rống"], roomlessFacts.availability);
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

function appendElevator(details, elevator) {
  if (!elevator) return;
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.append("Thang", " máy");
  row.append(label, document.createTextNode(": "), editableValue(elevator));
  details.append(row);
}

function appendFurniture(details, furniture) {
  if (!furniture) return;
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.append("Nội", " thất");
  row.append(label, document.createTextNode(": "), editableValue(furniture));
  details.append(row);
}

function appendDynamicServiceItem(list, service) {
  if (!service?.name || !service?.value) return;

  const item = document.createElement("li");
  const itemLabel = document.createElement("strong");
  itemLabel.append(editableValue(service.name));
  item.append(itemLabel, ": ", editableValue(service.value));

  if (Array.isArray(service.includes) && service.includes.length) {
    const includes = document.createElement("div");
    includes.className = "room-share-service-includes";
    const includesLabel = document.createElement("strong");
    includesLabel.append("G", "ồm");
    includes.append(includesLabel, ": ", editableValue(service.includes.join(", ")));
    item.append(includes);
  }

  list.append(item);
}

function appendServices(details, services = {}) {
  const electricity = String(services.electricity || "").trim();
  const water = String(services.water || "").trim();
  const serviceItems = Array.isArray(services.items) ? services.items : [];
  if (!electricity && !water && !serviceItems.length) return;

  const group = document.createElement("div");
  group.className = "room-share-service-group";

  const heading = document.createElement("p");
  heading.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.append("Dịch", " vụ");
  heading.append(label, document.createTextNode(":"));

  const list = document.createElement("ul");
  list.className = "room-share-services";

  if (electricity) {
    const item = document.createElement("li");
    const itemLabel = document.createElement("strong");
    itemLabel.append("Đi", "ện");
    item.append(itemLabel, ": ", editableValue(electricity));
    list.append(item);
  }

  if (water) {
    const item = document.createElement("li");
    const itemLabel = document.createElement("strong");
    itemLabel.append("N", "ước");
    item.append(itemLabel, ": ", editableValue(water));
    list.append(item);
  }

  serviceItems.forEach((service) => appendDynamicServiceItem(list, service));

  group.append(heading, list);
  details.append(group);
}

function renderSummary(container, summary = {}) {
  container.replaceChildren();
  container.classList.remove("is-empty");

  const details = document.createElement("div");
  details.className = "room-share-details";
  appendAddress(details, summary.address);
  appendRooms(details, Array.isArray(summary.rooms) ? summary.rooms : [], summary.floor);
  appendRoomType(details, summary.roomType);
  appendElevator(details, summary.elevator);
  appendFurniture(details, summary.furniture);
  appendServices(details, summary.services);
  container.append(details);
}

async function detectRoomSummary(source, signal) {
  const response = await fetch(ROOM_SUMMARY_AI_PATH, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source }),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.error || "ROOM_SUMMARY_AI_FAILED"), {
      code: payload.error || "ROOM_SUMMARY_AI_FAILED",
    });
  }

  const rooms = Array.isArray(payload.rooms)
    ? payload.rooms.map((room) => {
      const sourceRoom = String(room?.room || "").trim();
      return {
        room: roomValueIsFloorOnly(source, sourceRoom) ? "" : normalizeRoomCodeForDisplay(sourceRoom),
        price: String(room?.price || "").trim(),
        availability: String(room?.availability || "").trim(),
      };
    }).filter((room) => room.room || room.price || room.availability)
    : [];

  return {
    address: String(payload.address || "").trim(),
    rooms,
    floor: extractFloorForDisplay(source, rooms),
    roomType: String(payload.roomType || "").trim(),
    elevator: String(payload.elevator || "").trim(),
    furniture: normalizeFurnitureForDisplay(payload.furniture),
    services: servicesForDisplay(source, payload.services),
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
  let activeRequestController = null;
  renderEmpty(output);
  capture.disabled = true;

  const createSummary = async () => {
    const source = input.value.trim();
    if (!source) {
      requestVersion += 1;
      activeRequestController?.abort();
      activeRequestController = null;
      renderEmpty(output);
      capture.disabled = true;
      input.focus();
      return;
    }

    activeRequestController?.abort();
    const controller = new AbortController();
    activeRequestController = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), ROOM_SUMMARY_REQUEST_TIMEOUT_MS);
    const version = ++requestVersion;
    generate.disabled = true;
    generate.textContent = "Đang kiểm tra…";
    capture.disabled = true;
    renderSummary(output, {
      address: "…",
      rooms: [],
      floor: "",
      roomType: "",
      elevator: "",
      furniture: "",
      services: {},
    });

    try {
      const summary = await detectRoomSummary(source, controller.signal);
      if (version !== requestVersion) return;
      renderSummary(output, {
        address: summary.address || "Không xác định",
        rooms: summary.rooms,
        floor: summary.floor,
        roomType: summary.roomType,
        elevator: summary.elevator,
        furniture: summary.furniture,
        services: summary.services,
      });
      capture.disabled = false;
      output.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      if (version !== requestVersion) return;
      console.warn("Joy Sale room summary detection failed", error?.code || error?.message || error);
      renderSummary(output, {
        address: "Không xác định",
        rooms: [],
        floor: "",
        roomType: "",
        elevator: "",
        furniture: "",
        services: {},
      });
      capture.disabled = true;
    } finally {
      window.clearTimeout(timeoutId);
      if (activeRequestController === controller) activeRequestController = null;
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
    activeRequestController?.abort();
    activeRequestController = null;
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
