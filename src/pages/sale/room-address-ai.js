const ROOM_SUMMARY_AI_PATH = "/api/sales/room-summary/extract";
const ROOM_SUMMARY_REQUEST_TIMEOUT_MS = 20000;

function stripBullet(value) {
  return String(value ?? "").trim().replace(/^[-•*]\s*/u, "").trim();
}

function headerMatch(lineValue) {
  const line = String(lineValue ?? "").trim();
  const match = line.match(/^(Địa\s*chỉ|Phòng|Dạng\s*phòng|Thang\s*máy|Nội\s*thất|Dịch\s*vụ|Lưu\s*ý)\s*:\s*(.*)$/iu);
  if (!match) return null;
  const normalized = match[1]
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "");
  const keys = {
    diachi: "address",
    phong: "rooms",
    dangphong: "roomType",
    thangmay: "elevator",
    noithat: "furniture",
    dichvu: "services",
    luuy: "notes",
  };
  return { key: keys[normalized] || "", value: match[2].trim() };
}

function serviceKindFromName(nameValue) {
  const key = String(nameValue ?? "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (/^(?:mang|internet|wifi|net)$/u.test(key)) return "internet";
  if (/^(?:gui xe|de xe|xe may|parking)$/u.test(key)) return "parking";
  if (/^(?:ve sinh|ve sinh chung)$/u.test(key)) return "cleaning";
  if (/^(?:may giat|giat|giat say)$/u.test(key)) return "washing";
  if (/^(?:dich vu|dich vu chung|phi dich vu)$/u.test(key)) return "common";
  return "other";
}

function parsePreparedRoomLine(lineValue) {
  const line = stripBullet(lineValue);
  if (!line) return null;
  const parts = line.split("|").map((part) => part.trim());
  if (!parts[0]) return null;
  const label = parts[0];
  const price = parts[1] || "";
  const availability = parts[2] || "";
  const floor = label.match(/^tầng\s+(\d{1,2})$/iu);
  if (floor) {
    return {
      type: "floor",
      floor: String(Number(floor[1])),
      room: { room: "", price, availability },
    };
  }
  return {
    type: "room",
    floor: "",
    room: { room: label, price, availability },
  };
}

function parsePreparedServiceLine(lineValue) {
  const line = stripBullet(lineValue);
  if (!line) return null;
  const [main, ...tails] = line.split("|").map((part) => part.trim());
  const colon = main.indexOf(":");
  if (colon <= 0) return null;
  const name = main.slice(0, colon).trim();
  const value = main.slice(colon + 1).trim();
  if (!name || !value) return null;
  const includes = [];
  for (const tail of tails) {
    const includeMatch = tail.match(/^gồm\s*:\s*(.+)$/iu);
    if (!includeMatch) continue;
    includes.push(...includeMatch[1].split(",").map((item) => item.trim()).filter(Boolean));
  }
  return { name, value, includes };
}

export function parseJoyRoomText(sourceValue) {
  const lines = String(sourceValue ?? "").replace(/\r/g, "").split("\n");
  const sections = {
    address: [], rooms: [], roomType: [], elevator: [], furniture: [], services: [], notes: [],
  };
  const seen = new Set();
  let current = "";

  for (const rawLine of lines) {
    const line = String(rawLine ?? "").trim();
    if (!line) continue;
    const header = headerMatch(line);
    if (header?.key) {
      current = header.key;
      seen.add(current);
      if (header.value) sections[current].push(header.value);
      continue;
    }
    if (current) sections[current].push(line);
  }

  const required = ["address", "rooms", "roomType", "elevator", "furniture", "services"];
  if (!required.every((key) => seen.has(key))) return null;

  const roomRows = [];
  let floor = "";
  for (const line of sections.rooms) {
    const parsed = parsePreparedRoomLine(line);
    if (!parsed) continue;
    if (parsed.type === "floor") {
      if (floor && floor !== parsed.floor) return null;
      floor = parsed.floor;
      roomRows.push(parsed.room);
    } else {
      roomRows.push(parsed.room);
    }
  }
  if (!roomRows.length) return null;

  const services = { electricity: "", water: "", items: [] };
  for (const line of sections.services) {
    const parsed = parsePreparedServiceLine(line);
    if (!parsed) continue;
    const normalizedName = parsed.name
      .toLocaleLowerCase("vi")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .trim();
    if (normalizedName === "dien") {
      services.electricity = parsed.value;
      continue;
    }
    if (normalizedName === "nuoc") {
      services.water = parsed.value;
      continue;
    }
    services.items.push({
      kind: serviceKindFromName(parsed.name),
      name: parsed.name,
      value: parsed.value,
      includes: parsed.includes,
    });
  }

  const notes = sections.notes.map(stripBullet).filter(Boolean);
  return {
    prepared: true,
    address: sections.address.join(" ").trim(),
    rooms: roomRows,
    floor,
    roomType: sections.roomType.join(" ").trim(),
    elevator: sections.elevator.join(" ").trim(),
    furniture: sections.furniture.map(stripBullet).filter(Boolean).join(", "),
    services,
    notes,
  };
}

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
      .replace(/\/kwh$/iu, "/số");
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
  if (rooms.some((room) => String(room?.room || "").trim())) return "";

  const floors = new Set();
  const lines = String(sourceValue ?? "").split(/\r?\n/u);
  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line) continue;
    if (/^(?:[^\p{L}\p{N}]+)?(?:địa\s*chỉ|dia\s*chi|address|đc|dc)\s*[:：=-]/iu.test(line)) continue;
    for (const match of line.matchAll(/(?:phòng\s+)?tầng\s*[:#-]?\s*(\d{1,2})(?!\d)/giu)) {
      floors.add(String(Number(match[1])));
    }
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
  detail.textContent = "Dán Joy Room Text từ ChatGPT hoặc dán nguồn thô để Joy xử lý.";
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

function appendNotes(details, notes = []) {
  const values = Array.isArray(notes) ? notes.map((note) => String(note || "").trim()).filter(Boolean) : [];
  if (!values.length) return;
  const group = document.createElement("div");
  group.className = "room-share-service-group room-share-notes-group";
  const heading = document.createElement("p");
  heading.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.append("Lưu", " ý");
  heading.append(label, document.createTextNode(":"));
  const list = document.createElement("ul");
  list.className = "room-share-services room-share-notes";
  values.forEach((note) => {
    const item = document.createElement("li");
    item.append(editableValue(note));
    list.append(item);
  });
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
  appendNotes(details, summary.notes);
  container.append(details);
}

async function detectRoomSummary(source, signal) {
  const prepared = parseJoyRoomText(source);
  if (prepared) return prepared;

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
    prepared: false,
    address: String(payload.address || "").trim(),
    rooms,
    floor: extractFloorForDisplay(source, rooms),
    roomType: String(payload.roomType || "").trim(),
    elevator: String(payload.elevator || "").trim(),
    furniture: normalizeFurnitureForDisplay(payload.furniture),
    services: servicesForDisplay(source, payload.services),
    notes: [],
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
      notes: [],
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
        notes: summary.notes,
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
        notes: [],
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

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeRoomAddressAi, { once: true });
  } else {
    initializeRoomAddressAi();
  }
}
