const INTERNAL_PHRASES = [
  /(?:hoa\s*hồng|hoa\s*hong|commission)\s*[:\-]?\s*\d+(?:[.,]\d+)?\s*%?/giu,
  /\b(?:hh)\s*[:\-]?\s*\d+(?:[.,]\d+)?\s*%/giu,
  /\b(?:liên\s*hệ|lien\s*he|contact|zalo|sđt|sdt|phone)\s*[:\-]?\s*(?:\+?84|0)?(?:[\s.\-]?\d){8,10}/giu,
  /\b(?:nguồn|nguon)\s*[:\-]?\s*[^,;|\n]*/giu,
];

const PHONE_PATTERN = /(?:\+?84|0)(?:[\s.\-]?\d){8,10}/gu;
const URL_PATTERN = /https?:\/\/\S+|www\.\S+/giu;
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\uFE0F/gu;
const PRICE_SOURCE = String.raw`\d+(?:[.,]\d+)?\s*(?:tr(?:\d+)?|triệu|trieu|k|nghìn|nghin|vnđ|vnd|đ)(?:\s*\/\s*(?:tháng|thang))?`;
const PRICE_PATTERN = new RegExp(`\\b${PRICE_SOURCE}`, "iu");

const SERVICE_DEFINITIONS = [
  { key: "electricity", label: "Điện", patterns: ["điện", "dien"] },
  { key: "water", label: "Nước", patterns: ["nước", "nuoc"] },
  { key: "internet", label: "Internet", patterns: ["internet", "wifi", "wi-fi", "mạng", "mang"] },
  { key: "parking", label: "Gửi xe", patterns: ["gửi xe", "gui xe", "xe máy", "xe may", "để xe", "de xe"] },
  { key: "common", label: "Dịch vụ chung", patterns: ["dịch vụ", "dich vu", "phí dịch vụ", "phi dich vu", "vệ sinh", "ve sinh", "rác", "rac"] },
];

const ROOM_TYPE_KEYWORDS = [
  "studio", "1n1k", "1 ngủ 1 khách", "1 phòng ngủ", "duplex", "gác xép", "gac xep",
  "khép kín", "khep kin", "chung cư mini", "chung cu mini", "ccmn", "căn hộ", "can ho", "phòng trọ", "phong tro",
];
const FURNITURE_KEYWORDS = [
  "nội thất", "noi that", "full đồ", "full do", "full nội thất", "đủ đồ", "du do", "cơ bản", "co ban",
  "điều hòa", "dieu hoa", "nóng lạnh", "nong lanh", "giường", "giuong", "máy giặt", "may giat",
  "tủ lạnh", "tu lanh", "bếp", "bep", "bàn ghế", "ban ghe",
];
const NOTE_KEYWORDS = [
  "cọc", "coc", "hợp đồng", "hop dong", "giờ giấc", "gio giac", "pet", "thú cưng", "thu cung",
  "ở ghép", "o ghep", "số người", "so nguoi", "xe điện", "xe dien", "pccc", "ban công", "ban cong",
  "cửa sổ", "cua so", "khóa vân tay", "khoa van tay", "không chung chủ", "khong chung chu",
];
const AVAILABILITY_KEYWORDS = [
  "vào luôn", "vao luon", "ở ngay", "o ngay", "vào ở ngay", "vao o ngay", "đầu tháng", "dau thang",
  "cuối tháng", "cuoi thang", "từ ngày", "tu ngay", "sẵn phòng", "san phong",
];

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function stripInternalDetails(value) {
  let clean = String(value || "");
  for (const pattern of INTERNAL_PHRASES) clean = clean.replace(pattern, " ");
  return normalizeWhitespace(clean
    .replace(PHONE_PATTERN, " ")
    .replace(URL_PATTERN, " ")
    .replace(EMOJI_PATTERN, " ")
    .replace(/\s*[,;|]\s*[,;|]+/g, ", ")
    .replace(/\s+([,;])/g, "$1"));
}

function splitChunks(value) {
  return stripInternalDetails(value)
    .split(/\n+|\s*[;|•·]+\s*|(?<=[.!?])\s+|\s+-\s+(?=[A-Za-zÀ-ỹ0-9])/u)
    .flatMap((line) => line.split(/\s*,\s*(?=(?:phòng|phong|p\.?\s*\d+|tầng|tang|điện|dien|nước|nuoc|wifi|internet|gửi xe|gui xe|cọc|coc|hợp đồng|hop dong|không chung chủ|khong chung chu|pet|ban công|ban cong|cửa sổ|cua so|thang|nội thất|noi that)(?![\p{L}\p{N}]))/iu))
    .map((item) => item.trim().replace(/^[,.:\-\s]+|[,.:\-\s]+$/g, ""))
    .filter(Boolean);
}

function extractAddress(cleanText, chunks) {
  const labeled = cleanText.match(/(?:^|\n)\s*(?:địa chỉ|dia chi|đc|dc|address|tòa nhà|toa nha)\s*[:\-]\s*([^\n,;|]+)/iu);
  if (labeled) return labeled[1].trim();

  const firstLine = cleanText.split("\n").map((line) => line.trim()).find(Boolean) || "";
  const inferred = firstLine.match(/^((?:số\s*)?\d+[A-Za-z0-9/.\-]*\s+.*?)(?=\s+(?:còn|con|phòng|phong|p\.?\s*\d+|tầng|tang|giá|gia|studio|ccmn|full|thang|điện|dien|nước|nuoc|wifi|cọc|coc)\b|$)/iu);
  if (inferred) return inferred[1].replace(/^(?:địa chỉ|dia chi|đc|dc)\s*[:\-]?\s*/iu, "").trim();

  const candidate = chunks.find((chunk) => /\b\d+[A-Za-z0-9/.\-]*\s+[A-Za-zÀ-ỹ]/u.test(chunk)
    && !PRICE_PATTERN.test(chunk)
    && !containsAny(chunk, SERVICE_DEFINITIONS.flatMap((item) => item.patterns)));
  return candidate ? candidate.trim().replace(/^(?:tòa nhà|toa nha|địa chỉ|dia chi|đc|dc)\s*[:\-]?\s*/iu, "") : "";
}

function containsAny(value, keywords) {
  const normalized = normalizeSearch(value);
  return keywords.some((keyword) => normalized.includes(normalizeSearch(keyword)));
}

function compactText(value) {
  return normalizeWhitespace(String(value || "")
    .replace(/^(?:còn phòng|con phong|phòng trống|phong trong|còn|con)\s*[:\-]?\s*/iu, "")
    .replace(/\bgiá\s*[:\-]?\s*/giu, "")
    .replace(/\b(?:hoa\s*hồng|hoa\s*hong|hh)\b.*$/giu, ""));
}

function normalizePrice(value) {
  return String(value || "")
    .replace(/(\d+(?:[.,]\d+)?)\s*triệu/giu, (_, amount) => `${amount.replace(",", ".")}tr`)
    .replace(/(\d+(?:[.,]\d+)?)\s*trieu/giu, (_, amount) => `${amount.replace(",", ".")}tr`)
    .replace(/(\d)\s+tr\b/giu, "$1tr")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRooms(chunks, address) {
  const rooms = [];
  const seen = new Set();
  const roomMatcher = new RegExp(`\\b(phòng\\s+tầng|phong\\s+tang|tầng|tang|phòng|phong|p\\.?)\\s*([A-Za-z]*\\d[A-Za-z0-9./\\-]*)[^\\n,;|]*?(?:giá\\s*[:\\-]?\\s*)?(${PRICE_SOURCE})`, "giu");

  for (const original of chunks) {
    let chunk = original;
    if (address && normalizeSearch(chunk).startsWith(normalizeSearch(address))) {
      chunk = chunk.slice(address.length).trim();
    }
    const normalized = normalizeSearch(chunk);
    const noteKeyword = AVAILABILITY_KEYWORDS.find((keyword) => normalized.includes(normalizeSearch(keyword))) || "";
    const matches = [...chunk.matchAll(roomMatcher)];
    for (const match of matches) {
      const prefix = normalizeSearch(match[1]);
      const title = prefix.includes("tang") ? `Tầng ${match[2]}` : `Phòng ${match[2]}`;
      const price = normalizePrice(match[3]);
      const key = `${normalizeSearch(title)}|${normalizeSearch(price)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rooms.push({ title, price, note: noteKeyword ? humanizeKeyword(noteKeyword) : "" });
    }

    if (!matches.length && (normalized.includes("phong trong") || normalized.includes("con phong")) && PRICE_PATTERN.test(chunk)) {
      const price = normalizePrice(chunk.match(PRICE_PATTERN)?.[0] || "");
      const key = `phong dang trong|${normalizeSearch(price)}`;
      if (!seen.has(key)) {
        seen.add(key);
        rooms.push({ title: "Phòng đang trống", price, note: noteKeyword ? humanizeKeyword(noteKeyword) : "" });
      }
    }
  }
  return rooms;
}

function humanizeKeyword(value) {
  const normalized = normalizeSearch(value);
  const labels = new Map([
    ["vao luon", "Có thể vào ở ngay"],
    ["o ngay", "Có thể vào ở ngay"],
    ["vao o ngay", "Có thể vào ở ngay"],
    ["san phong", "Phòng đang sẵn"],
    ["dau thang", "Có thể vào ở đầu tháng"],
    ["cuoi thang", "Có thể vào ở cuối tháng"],
  ]);
  return labels.get(normalized) || value.trim();
}

function firstMatchingChunk(chunks, keywords) {
  return chunks.find((chunk) => containsAny(chunk, keywords)) || "";
}

function extractRoomType(chunks) {
  const chunk = firstMatchingChunk(chunks, ROOM_TYPE_KEYWORDS);
  if (!chunk) return "";
  const keyword = ROOM_TYPE_KEYWORDS.find((item) => containsAny(chunk, [item]));
  return keyword ? keyword.replace(/^./u, (character) => character.toUpperCase()) : compactText(chunk);
}

function extractStairs(chunks) {
  const combined = chunks.join(" · ");
  const normalized = normalizeSearch(combined);
  if (normalized.includes("khong thang may")) return "Không có thang máy";
  if (normalized.includes("thang may")) return "Thang máy";
  if (normalized.includes("thang bo") || normalized.includes("cau thang bo")) return "Thang bộ";
  return "";
}

function extractFurniture(chunks) {
  const matches = chunks.filter((chunk) => containsAny(chunk, FURNITURE_KEYWORDS));
  if (!matches.length) return "";
  const cleaned = matches
    .map((chunk) => compactText(chunk)
      .replace(/^(?:nội thất|noi that)\s*[:\-]?\s*/iu, "")
      .replace(/\b(?:điện|dien|nước|nuoc|wifi|internet|gửi xe|gui xe|cọc|coc)\b.*$/iu, "")
      .trim())
    .filter(Boolean);
  return [...new Set(cleaned)].join(" · ");
}

function extractServices(cleanText) {
  const aliases = SERVICE_DEFINITIONS.flatMap((definition) => definition.patterns)
    .sort((a, b) => b.length - a.length);
  const combined = aliases.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const matcher = new RegExp(`(?<![\\p{L}\\p{N}])(${combined})(?![\\p{L}\\p{N}])\\s*[:\\-]?\\s*`, "giu");
  const matches = [...cleanText.matchAll(matcher)];
  const services = [];
  const seen = new Set();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const alias = normalizeSearch(match[1]);
    const definition = SERVICE_DEFINITIONS.find((item) => item.patterns.some((pattern) => normalizeSearch(pattern) === alias));
    if (!definition || seen.has(definition.key)) continue;
    const valueStart = Number(match.index) + match[0].length;
    const valueEnd = index + 1 < matches.length ? Number(matches[index + 1].index) : cleanText.length;
    let value = cleanText.slice(valueStart, valueEnd)
      .split(/[\n;|]/, 1)[0]
      .replace(/^[,.:\-\s]+|[,.:\-\s]+$/g, "")
      .trim();
    if (definition.key === "common") value = value.replace(/^(?:chung|common)\s*[:\-]?\s*/iu, "");
    value = compactText(value);
    if (!value || value.length > 80) continue;
    services.push({ key: definition.key, label: definition.label, value });
    seen.add(definition.key);
  }
  if (!seen.has("parking")) {
    const fallback = cleanText.match(/(?:^|[\n,;|])\s*xe\s*[:\-]?\s*([^\n,;|]+)/iu);
    const value = compactText(fallback?.[1] || "").replace(/[.;,]+$/g, "").trim();
    if (value && value.length <= 80) services.push({ key: "parking", label: "Gửi xe", value });
  }
  return services;
}

function extractNotes(chunks, usedText) {
  const used = new Set([...usedText].map(normalizeSearch));
  const notes = [];
  for (const chunk of chunks) {
    const normalized = normalizeSearch(chunk);
    if (!normalized || used.has(normalized)) continue;
    const roomChunk = (/\b(?:phong|p\.?|tang)\s*[a-z]*\d[a-z0-9./\-]*/iu.test(normalized)
      || normalized.includes("con phong") || normalized.includes("phong trong")) && PRICE_PATTERN.test(chunk);
    if (roomChunk || containsAny(chunk, SERVICE_DEFINITIONS.flatMap((item) => item.patterns)) || containsAny(chunk, FURNITURE_KEYWORDS)) continue;
    if (containsAny(chunk, NOTE_KEYWORDS) || containsAny(chunk, AVAILABILITY_KEYWORDS)) {
      const clean = compactText(chunk);
      if (clean && !notes.some((item) => normalizeSearch(item) === normalizeSearch(clean))) notes.push(clean);
    }
  }
  return notes.slice(0, 5);
}

export function summarizeRoomListing(rawInput) {
  const original = normalizeWhitespace(rawInput);
  const cleanText = stripInternalDetails(original);
  const chunks = splitChunks(cleanText);
  const address = extractAddress(cleanText, chunks);
  const rooms = extractRooms(chunks, address);
  const roomType = extractRoomType(chunks);
  const stairs = extractStairs(chunks);
  const furniture = extractFurniture(chunks);
  const services = extractServices(cleanText);
  const used = new Set([
    address,
    roomType,
    furniture,
    ...rooms.flatMap((room) => [room.title, room.price, room.note]),
    ...services.flatMap((service) => [service.label, service.value]),
  ].filter(Boolean));
  const notes = extractNotes(chunks, used);

  return {
    address,
    rooms,
    roomType,
    stairs,
    furniture,
    services,
    notes,
    isEmpty: !address && !rooms.length && !roomType && !stairs && !furniture && !services.length && !notes.length,
  };
}

function editableText(tagName, className, text) {
  const node = document.createElement(tagName);
  node.className = className;
  node.textContent = text;
  node.contentEditable = "true";
  node.spellcheck = false;
  return node;
}

function renderSection(container, title, body) {
  const section = document.createElement("section");
  section.className = "room-share-section";
  const heading = document.createElement("p");
  heading.className = "room-share-label";
  heading.textContent = title;
  section.append(heading, body);
  container.append(section);
}

export function renderRoomSummary(container, summary, { editable = true } = {}) {
  container.replaceChildren();
  container.classList.toggle("is-empty", summary.isEmpty);
  if (summary.isEmpty) {
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
    return;
  }

  const kicker = document.createElement("p");
  kicker.className = "room-share-kicker";
  kicker.textContent = "THÔNG TIN PHÒNG";
  const address = editableText("h3", "room-share-address", summary.address || "Địa chỉ chưa rõ");
  address.contentEditable = String(editable);
  container.append(kicker, address);

  if (summary.rooms.length) {
    const list = document.createElement("div");
    list.className = "room-share-rooms";
    for (const room of summary.rooms) {
      const item = document.createElement("div");
      item.className = "room-share-room";
      const top = document.createElement("div");
      const title = editableText("strong", "room-share-room-title", room.title);
      const price = editableText("span", "room-share-price", room.price);
      title.contentEditable = price.contentEditable = String(editable);
      top.append(title, price);
      item.append(top);
      if (room.note) {
        const note = editableText("small", "room-share-room-note", room.note);
        note.contentEditable = String(editable);
        item.append(note);
      }
      list.append(item);
    }
    renderSection(container, "Còn phòng", list);
  }

  const facts = [
    ["Dạng phòng", summary.roomType],
    ["Thang", summary.stairs],
    ["Nội thất", summary.furniture],
  ].filter(([, value]) => value);
  if (facts.length) {
    const factList = document.createElement("div");
    factList.className = "room-share-facts";
    for (const [label, value] of facts) {
      const row = document.createElement("div");
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      const valueNode = editableText("strong", "room-share-fact-value", value);
      valueNode.contentEditable = String(editable);
      row.append(labelNode, valueNode);
      factList.append(row);
    }
    container.append(factList);
  }

  if (summary.services.length) {
    const serviceList = document.createElement("div");
    serviceList.className = "room-share-services";
    for (const service of summary.services) {
      const row = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = service.label;
      const value = editableText("strong", "room-share-service-value", service.value);
      value.contentEditable = String(editable);
      row.append(label, value);
      serviceList.append(row);
    }
    renderSection(container, "Dịch vụ", serviceList);
  }

  if (summary.notes.length) {
    const notes = document.createElement("ul");
    notes.className = "room-share-notes";
    for (const note of summary.notes) {
      const item = document.createElement("li");
      const value = editableText("span", "room-share-note-value", note);
      value.contentEditable = String(editable);
      item.append(value);
      notes.append(item);
    }
    renderSection(container, "Lưu ý", notes);
  }
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
