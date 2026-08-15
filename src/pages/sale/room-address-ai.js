function stripBullet(value) {
  return String(value ?? "").trim().replace(/^[-•*]\s*/u, "").trim();
}

function fold(value) {
  return String(value ?? "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function headerMatch(lineValue) {
  const line = String(lineValue ?? "").trim();
  const match = line.match(/^(Địa\s*chỉ|Phòng|Dạng\s*phòng|Thang\s*máy|Nội\s*thất|Dịch\s*vụ|Lưu\s*ý)\s*:\s*(.*)$/iu);
  if (!match) return null;

  const normalized = fold(match[1]).replace(/\s+/g, "");
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
  const key = fold(nameValue).replace(/[^a-z0-9]+/g, " ").trim();
  if (/^(?:mang|internet|wifi|net)$/u.test(key)) return "internet";
  if (/^(?:gui xe|de xe|xe may|parking)$/u.test(key)) return "parking";
  if (/^(?:ve sinh|ve sinh chung)$/u.test(key)) return "cleaning";
  if (/^(?:may giat|giat|giat say)$/u.test(key)) return "washing";
  if (/^(?:dich vu|dich vu chung|phi dich vu)$/u.test(key)) return "common";
  return "other";
}

function parseRoomLine(lineValue) {
  const line = stripBullet(lineValue);
  if (!line) return null;

  const parts = line.split("|").map((part) => part.trim());
  if (!parts[0] || parts.length > 3) return null;

  const label = parts[0];
  const price = parts[1] || "";
  const availability = parts[2] || "";
  const floor = label.match(/^tầng\s+(\d{1,2})$/iu);

  if (floor) {
    return {
      type: "floor",
      floor: String(Number(floor[1])),
      row: { room: "", price, availability },
    };
  }

  return {
    type: "room",
    floor: "",
    row: { room: label, price, availability },
  };
}

function parseServiceLine(lineValue) {
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
    if (!includeMatch) return null;
    includes.push(...includeMatch[1].split(",").map((item) => item.trim()).filter(Boolean));
  }

  return { name, value, includes };
}

export function parseJoyRoomText(sourceValue) {
  const lines = String(sourceValue ?? "").replace(/\r/g, "").split("\n");
  const sections = {
    address: [],
    rooms: [],
    roomType: [],
    elevator: [],
    furniture: [],
    services: [],
    notes: [],
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

    if (!current) return null;
    sections[current].push(line);
  }

  const required = ["address", "rooms", "roomType", "elevator", "furniture", "services", "notes"];
  if (!required.every((key) => seen.has(key))) return null;

  const address = sections.address.join(" ").trim();
  if (!address) return null;

  const rooms = [];
  let floor = "";
  let hasCodedRoom = false;
  for (const line of sections.rooms) {
    const parsed = parseRoomLine(line);
    if (!parsed) return null;

    if (parsed.type === "floor") {
      if (floor && floor !== parsed.floor) return null;
      floor = parsed.floor;
    } else {
      hasCodedRoom = true;
    }
    rooms.push(parsed.row);
  }

  if (!rooms.length || (floor && hasCodedRoom)) return null;

  const services = { electricity: "", water: "", items: [] };
  for (const line of sections.services) {
    const parsed = parseServiceLine(line);
    if (!parsed) return null;

    const normalizedName = fold(parsed.name).trim();
    if (normalizedName === "dien") {
      if (services.electricity) return null;
      services.electricity = parsed.value;
      continue;
    }
    if (normalizedName === "nuoc") {
      if (services.water) return null;
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

  return {
    address,
    rooms,
    floor,
    roomType: sections.roomType.join(" ").trim(),
    elevator: sections.elevator.join(" ").trim(),
    furniture: sections.furniture.map(stripBullet).filter(Boolean).join(", "),
    services,
    notes: sections.notes.map(stripBullet).filter(Boolean),
  };
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
  detail.textContent = "Soạn Joy Room Text trong ChatGPT, sau đó dán nguyên bản vào đây.";
  empty.append(mark, title, detail);
  container.append(empty);
}

function renderFormatError(container) {
  container.replaceChildren();
  container.classList.add("is-empty");

  const empty = document.createElement("div");
  empty.className = "room-share-empty";
  const mark = document.createElement("span");
  mark.textContent = "!";
  const title = document.createElement("strong");
  title.textContent = "Joy Room Text chưa đúng format";
  const detail = document.createElement("p");
  detail.textContent = "Hãy quay lại ChatGPT, chỉnh bản soạn theo Joy Room Text v1 rồi dán lại toàn bộ.";
  empty.append(mark, title, detail);
  container.append(empty);
}

function appendAddress(details, address) {
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const label = document.createElement("strong");
  label.textContent = "Địa chỉ";
  row.append(label, document.createTextNode(": "), editableValue(address));
  details.append(row);
}

function appendPriceAndAvailability(target, room) {
  if (room.price) target.append(document.createTextNode(" · "), editableValue(room.price));
  if (room.availability) target.append(document.createTextNode(" · "), editableValue(room.availability));
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
  appendFloorFacts(details, floor, roomlessFacts);
}

function appendRoomType(details, roomType) {
  appendLabeledValue(details, ["Dạng", " phòng"], roomType);
}

function appendElevator(details, elevator) {
  appendLabeledValue(details, ["Thang", " máy"], elevator);
}

function appendFurniture(details, furniture) {
  appendLabeledValue(details, ["Nội", " thất"], furniture);
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

function renderSummary(container, summary) {
  container.replaceChildren();
  container.classList.remove("is-empty");

  const details = document.createElement("div");
  details.className = "room-share-details";
  appendAddress(details, summary.address);
  appendRooms(details, summary.rooms, summary.floor);
  appendRoomType(details, summary.roomType);
  appendElevator(details, summary.elevator);
  appendFurniture(details, summary.furniture);
  appendServices(details, summary.services);
  appendNotes(details, summary.notes);
  container.append(details);
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

  renderEmpty(output);
  capture.disabled = true;

  const createSummary = () => {
    const source = input.value.trim();
    if (!source) {
      renderEmpty(output);
      capture.disabled = true;
      input.focus();
      return;
    }

    const summary = parseJoyRoomText(source);
    if (!summary) {
      renderFormatError(output);
      capture.disabled = true;
      return;
    }

    renderSummary(output, summary);
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
    document.addEventListener("DOMContentLoaded", initializeRoomAddressAi, { once: true });
  } else {
    initializeRoomAddressAi();
  }
}
