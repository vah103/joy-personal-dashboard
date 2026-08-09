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
  { key: "internet", label: "Mạng", patterns: ["internet", "wifi", "wi-fi", "mạng", "mang"] },
  { key: "common", label: "Dịch vụ chung", patterns: ["dịch vụ chung", "dich vu chung", "phí dịch vụ", "phi dich vu", "dvc"] },
  { key: "parking", label: "Gửi xe", patterns: ["gửi xe", "gui xe", "free\\s+\\d+\\s+xe", "miễn phí\\s+\\d+\\s+xe", "mien phi\\s+\\d+\\s+xe", "xe(?=\\s*[:\\-]?\\s*\\d)"] },
  { key: "fridge", label: "Tủ lạnh", patterns: ["tủ\\s+lạnh", "tu\\s+lanh"] },
  { key: "laundry", label: "Giặt sấy", patterns: ["giặt\\s+sấy", "giat\\s+say"] },
];

const ROOM_TYPE_KEYWORDS = [
  "studio", "1n1k", "1 ngủ 1 khách", "1 phòng ngủ", "duplex", "gác xép", "gac xep",
  "khép kín", "khep kin", "chung cư mini", "chung cu mini", "ccmn", "căn hộ", "can ho", "phòng trọ", "phong tro",
];
const FURNITURE_KEYWORDS = [
  "nội thất", "noi that", "full đồ", "full do", "full nội thất", "đủ đồ", "du do", "cơ bản", "co ban",
  "điều hòa", "dieu hoa", "nóng lạnh", "nong lanh", "giường", "giuong", "máy giặt", "may giat",
  "tủ lạnh", "tu lanh", "bếp", "bep", "bàn ghế", "ban ghe", "máy lọc nước", "may loc nuoc",
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

const LABELED_FIELDS = new Map([
  ["dia chi", "address"],
  ["dc", "address"],
  ["address", "address"],
  ["toa nha", "address"],
  ["trong", "availability"],
  ["phong trong", "availability"],
  ["con phong", "availability"],
  ["phong", "availability"],
  ["gia", "price"],
  ["gia phong", "price"],
  ["dang phong", "roomType"],
  ["loai phong", "roomType"],
  ["thang", "stairs"],
  ["thang may", "stairs"],
  ["noi that", "furniture"],
  ["dich vu", "services"],
  ["phi dich vu", "services"],
  ["luu y", "notes"],
  ["ghi chu", "notes"],
]);

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

function containsAny(value, keywords) {
  const normalized = normalizeSearch(value);
  return keywords.some((keyword) => normalized.includes(normalizeSearch(keyword)));
}

function capitalizeFirst(value) {
  const text = String(value || "").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function lowerFirst(value) {
  const text = String(value || "").trim();
  return text ? text[0].toLowerCase() + text.slice(1) : "";
}

function stripDecorations(value) {
  return String(value || "")
    .replace(EMOJI_PATTERN, "")
    .replace(/^[\s•·*☘🌷🏢⌛⭐🏆\-–—]+/u, "")
    .trim();
}

function isInternalLine(value) {
  const clean = stripDecorations(value);
  const normalized = normalizeSearch(clean);
  if (!normalized) return true;
  return /^\d+\s*%/u.test(normalized)
    || /\b(?:ma|code)\s*:/u.test(normalized)
    || /nguon hang cap nhat/u.test(normalized)
    || /qua hen xem.*(?:alo|goi).*truoc/u.test(normalized)
    || /^(?:tl\d*house|tlhouse)$/u.test(normalized.replace(/\s+/g, ""))
    || /^(?:nguon|source|ctv)\b/u.test(normalized);
}

function stripInternalDetails(value) {
  const keptLines = normalizeWhitespace(value)
    .split("\n")
    .filter((line) => !isInternalLine(line));

  let clean = keptLines.join("\n");
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
    .flatMap((line) => line.split(/\s*,\s*(?=(?:phòng|phong|p\.?\s*\d+|tầng|tang|điện|dien|nước|nuoc|wifi|internet|mạng|mang|dvc|gửi xe|gui xe|cọc|coc|hợp đồng|hop dong|không chung chủ|khong chung chu|pet|ban công|ban cong|cửa sổ|cua so|thang|nội thất|noi that)(?![\p{L}\p{N}]))/iu))
    .map((item) => item.trim().replace(/^[,.\-:\s]+|[,.\-:\s]+$/g, ""))
    .filter(Boolean);
}

function parseLabeledListing(value) {
  const fields = {};
  const notes = [];
  let currentSection = "";
  let recognizedFieldCount = 0;

  for (const rawLine of normalizeWhitespace(value).split("\n")) {
    const line = stripDecorations(rawLine);
    if (!line || isInternalLine(line)) continue;

    const labeled = line.match(/^([^:：]{1,36})\s*[:：]\s*(.*)$/u);
    if (labeled) {
      const label = normalizeSearch(labeled[1]).replace(/\s+/g, " ").trim();
      const field = LABELED_FIELDS.get(label);
      if (!field) {
        currentSection = "";
        continue;
      }

      recognizedFieldCount += 1;
      const fieldValue = stripDecorations(labeled[2]);
      currentSection = field;

      if (field === "notes") {
        if (fieldValue) notes.push(fieldValue);
      } else if (fieldValue) {
        fields[field] = fields[field] ? `${fields[field]}\n${fieldValue}` : fieldValue;
      }
      continue;
    }

    if (currentSection === "notes") {
      notes.push(line);
    } else if (currentSection === "furniture"
      && (containsAny(line, SERVICE_DEFINITIONS.flatMap((item) => item.patterns)) || containsAny(line, NOTE_KEYWORDS))) {
      currentSection = "";
    } else if (["services", "furniture"].includes(currentSection)) {
      fields[currentSection] = fields[currentSection]
        ? `${fields[currentSection]}\n${line}`
        : line;
    }
  }

  return { fields, notes, recognizedFieldCount };
}

function cleanAddress(value) {
  return normalizeWhitespace(value)
    .replace(/^(?:địa chỉ|dia chi|đc|dc|address|tòa nhà|toa nha)\s*[:\-]?\s*/iu, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/^số(?=\s)/iu, "Số")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s{2,}/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim();
}

function extractAddress(cleanText, chunks) {
  const labeled = cleanText.match(/(?:^|\n)\s*(?:địa chỉ|dia chi|đc|dc|address|tòa nhà|toa nha)\s*[:\-]\s*([^\n,;|]+)/iu);
  if (labeled) return cleanAddress(labeled[1]);

  const firstLine = cleanText.split("\n").map((line) => line.trim()).find(Boolean) || "";
  const inferred = firstLine.match(/^((?:số\s*)?\d+[A-Za-z0-9/.\-]*\s+.*?)(?=\s+(?:còn|con|phòng|phong|p\.?\s*\d+|tầng|tang|giá|gia|studio|ccmn|full|thang|điện|dien|nước|nuoc|wifi|cọc|coc)\b|$)/iu);
  if (inferred) return cleanAddress(inferred[1]);

  const candidate = chunks.find((chunk) => /\b\d+[A-Za-z0-9/.\-]*\s+[A-Za-zÀ-ỹ]/u.test(chunk)
    && !PRICE_PATTERN.test(chunk)
    && !containsAny(chunk, SERVICE_DEFINITIONS.flatMap((item) => item.patterns)));
  return candidate ? cleanAddress(candidate) : "";
}

function compactText(value) {
  return normalizeWhitespace(String(value || "")
    .replace(/^(?:còn phòng|con phong|phòng trống|phong trong|còn|con)\s*[:\-]?\s*/iu, "")
    .replace(/\bgiá\s*[:\-]?\s*/giu, "")
    .replace(/\b(?:hoa\s*hồng|hoa\s*hong|hh)\b.*$/giu, ""));
}

function normalizePrice(value, { monthly = false } = {}) {
  let clean = String(value || "")
    .replace(/(\d+(?:[.,]\d+)?)\s*triệu/giu, (_, amount) => `${amount.replace(",", ".")}tr`)
    .replace(/(\d+(?:[.,]\d+)?)\s*trieu/giu, (_, amount) => `${amount.replace(",", ".")}tr`)
    .replace(/(\d)\s+tr\b/giu, "$1tr")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();

  if (monthly && clean && !/\/(?:tháng|thang)\b/iu.test(clean)) clean = `${clean}/tháng`;
  return clean;
}

function normalizeAvailability(value) {
  const clean = compactText(value)
    .replace(/^(?:trống|trong)\s*[:\-]?\s*/iu, "")
    .replace(/\s+/g, " ")
    .trim();

  const datedRoom = clean.match(/^([A-Za-z]*\d+[A-Za-z0-9/.\-]*)\s*\(\s*([^)]+)\s*\)$/u);
  if (datedRoom) return `${datedRoom[1]}, trống ${datedRoom[2]}`;
  return clean;
}

function normalizeRoomType(value) {
  const clean = compactText(value).replace(/^(?:dạng phòng|dang phong|loại phòng|loai phong)\s*[:\-]?\s*/iu, "");
  return capitalizeFirst(clean.toLowerCase());
}

function normalizeStairs(value) {
  const normalized = normalizeSearch(value);
  if (!normalized) return "";
  if (normalized.includes("khong") || normalized.includes("bo")) return "Không";
  if (normalized.includes("may") || normalized === "co" || normalized.includes("co thang")) return "Có";
  return capitalizeFirst(String(value).toLowerCase());
}

function normalizeFurniture(value) {
  const clean = normalizeWhitespace(value)
    .replace(/^(?:nội thất|noi that)\s*[:\-]?\s*/iu, "")
    .replace(/\s*[-–—]\s*/g, ", ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,{2,}/g, ",")
    .replace(/^full\s+như\s+hình/iu, "Full đồ như hình")
    .replace(/^full\s+do\s+nhu\s+hinh/iu, "Full đồ như hình")
    .trim();

  return clean
    .split(/\s*,\s*/u)
    .filter(Boolean)
    .map((part, index) => index === 0 ? capitalizeFirst(part) : lowerFirst(part))
    .join(", ");
}

function normalizeServiceValue(key, value) {
  let clean = normalizeWhitespace(value)
    .replace(/^[,.;:+\-\s]+|[,.;:+\-\s]+$/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  clean = clean
    .replace(/\/phong\b/giu, "/phòng")
    .replace(/\/thang\b/giu, "/tháng");

  if (key === "electricity") {
    clean = clean.replace(/\b(\d{4,})\b/gu, (match, amount) => {
      const number = Number(amount);
      return number % 1000 === 0 ? `${number / 1000}k` : match;
    });
  }

  if (key === "water") clean = clean.replace(/\/m3\b/giu, "/m³");
  if (["common", "laundry"].includes(key)) clean = clean.replace(/\/ng\b/giu, "/người");
  if (key === "parking") {
    clean = clean
      .replace(/\s*\(\s*/g, ", ")
      .replace(/\s*\)\s*/g, "")
      .replace(/\bxe\s*t\s*(\d+)\b/giu, "xe thứ $1")
      .replace(/\bfree\b/giu, "Free")
      .replace(/\s*,\s*/g, ", ");
  }

  return clean;
}

function isInsideParentheses(value, index) {
  let depth = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (value[cursor] === "(") depth += 1;
    if (value[cursor] === ")" && depth > 0) depth -= 1;
  }
  return depth > 0;
}

function extractServices(serviceText) {
  const text = normalizeWhitespace(serviceText)
    .replace(/^(?:dịch vụ|dich vu|phí dịch vụ|phi dich vu)\s*[:\-]?\s*/iu, "");
  if (!text) return [];

  const markerMatches = [];
  for (const definition of SERVICE_DEFINITIONS) {
    for (const source of definition.patterns) {
      const matcher = new RegExp(`(?<![\\p{L}\\p{N}])(${source})(?![\\p{L}\\p{N}])\\s*[:+\\-]?\\s*`, "giu");
      for (const match of text.matchAll(matcher)) {
        const matchIndex = Number(match.index);
        if (isInsideParentheses(text, matchIndex)) continue;
        markerMatches.push({
          key: definition.key,
          label: definition.label,
          index: matchIndex,
          end: matchIndex + match[0].length,
          marker: match[1],
        });
      }
    }
  }

  markerMatches.sort((a, b) => a.index - b.index || b.end - a.end);
  const uniqueMarkers = markerMatches.filter((marker, index) => (
    index === 0 || marker.index !== markerMatches[index - 1].index
  ));
  const services = [];
  const seen = new Set();

  uniqueMarkers.forEach((marker, index) => {
    if (seen.has(marker.key)) return;
    const nextIndex = index + 1 < uniqueMarkers.length ? uniqueMarkers[index + 1].index : text.length;
    let value = text.slice(marker.end, nextIndex).split(/[;\n]/, 1)[0];
    if (marker.key === "parking" && /^free|^miễn phí|^mien phi/iu.test(marker.marker)) {
      value = `${marker.marker} ${value}`;
    }
    value = normalizeServiceValue(marker.key, value);
    if (!value || value.length > 180) return;
    services.push({ key: marker.key, label: marker.label, value });
    seen.add(marker.key);
  });

  return services;
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
      const roomPrice = normalizePrice(match[3]);
      const key = `${normalizeSearch(title)}|${normalizeSearch(roomPrice)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rooms.push({ title, price: roomPrice, note: noteKeyword ? humanizeKeyword(noteKeyword) : "" });
    }

    if (!matches.length && (normalized.includes("phong trong") || normalized.includes("con phong")) && PRICE_PATTERN.test(chunk)) {
      const roomPrice = normalizePrice(chunk.match(PRICE_PATTERN)?.[0] || "");
      const key = `phong dang trong|${normalizeSearch(roomPrice)}`;
      if (!seen.has(key)) {
        seen.add(key);
        rooms.push({ title: "Phòng đang trống", price: roomPrice, note: noteKeyword ? humanizeKeyword(noteKeyword) : "" });
      }
    }
  }
  return rooms;
}

function roomsFromStructuredFields(availability, price) {
  if (!availability && !price) return [];
  const roomCodes = [...String(availability || "").matchAll(/\bP?\d+[A-Za-z0-9/.\-]*\b/giu)]
    .map((match) => match[0])
    .filter((value) => !/^\d{1,2}\/\d{1,2}$/u.test(value));
  if (!roomCodes.length) {
    return [{ title: "Phòng đang trống", price, note: availability }];
  }

  const noteMatch = String(availability).match(/\btrống\s+(.+)$/iu);
  return roomCodes.map((code) => ({
    title: `Phòng ${code}`,
    price,
    note: noteMatch ? `Trống ${noteMatch[1]}` : "",
  }));
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
  return keyword ? capitalizeFirst(keyword) : compactText(chunk);
}

function extractStairs(chunks) {
  const combined = chunks.join(" · ");
  const normalized = normalizeSearch(combined);
  if (normalized.includes("khong thang may")) return "Không";
  if (normalized.includes("thang may")) return "Có";
  if (normalized.includes("thang bo") || normalized.includes("cau thang bo")) return "Không";
  return "";
}

function extractFurniture(chunks) {
  const matches = chunks.filter((chunk) => containsAny(chunk, FURNITURE_KEYWORDS));
  if (!matches.length) return "";
  const cleaned = matches
    .map((chunk) => compactText(chunk)
      .replace(/^(?:studio|1n1k|duplex|ccmn|chung cư mini|chung cu mini)\s*,?\s*/iu, "")
      .replace(/^(?:nội thất|noi that)\s*[:\-]?\s*/iu, "")
      .replace(/\b(?:điện|dien|nước|nuoc|wifi|internet|mạng|mang|gửi xe|gui xe|cọc|coc)\b.*$/iu, "")
      .trim())
    .filter(Boolean);
  return normalizeFurniture([...new Set(cleaned)].join(", "));
}

function shouldHideNote(value) {
  const normalized = normalizeSearch(value);
  return !normalized
    || /nguon hang|tl\d*house|qua hen xem|alo truoc|goi truoc|hoa hong|commission/u.test(normalized)
    || /^\d+\s*%/u.test(normalized)
    || /\bma\s*:/u.test(normalized);
}

function normalizeNote(value) {
  const stripped = stripDecorations(value)
    .replace(/^[\-–—•·*]+\s*/u, "")
    .replace(/[.!]+$/g, "")
    .trim();
  if (!stripped || shouldHideNote(stripped)) return "";

  let clean = stripped;
  if (clean === clean.toUpperCase()) clean = clean.toLowerCase();
  clean = capitalizeFirst(clean);
  clean = clean.replace(/^Không chung chủ giờ giấc tự do$/iu, "Không chung chủ, giờ giấc tự do");
  return clean;
}

function extractNotes(chunks, usedText) {
  const used = new Set([...usedText].map(normalizeSearch));
  const notes = [];
  for (const chunk of chunks) {
    const normalized = normalizeSearch(chunk);
    if (!normalized || used.has(normalized) || shouldHideNote(chunk)) continue;
    const roomChunk = (/\b(?:phong|p\.?|tang)\s*[a-z]*\d[a-z0-9./\-]*/iu.test(normalized)
      || normalized.includes("con phong") || normalized.includes("phong trong")) && PRICE_PATTERN.test(chunk);
    if (roomChunk || containsAny(chunk, SERVICE_DEFINITIONS.flatMap((item) => item.patterns)) || containsAny(chunk, FURNITURE_KEYWORDS)) continue;
    if (containsAny(chunk, NOTE_KEYWORDS) || containsAny(chunk, AVAILABILITY_KEYWORDS)) {
      const clean = normalizeNote(compactText(chunk));
      if (clean && !notes.some((item) => normalizeSearch(item) === normalizeSearch(clean))) notes.push(clean);
    }
  }
  return notes.slice(0, 8);
}

function deriveAvailabilityFromRooms(rooms) {
  if (!rooms.length) return "";
  if (rooms.length === 1) {
    const code = rooms[0].title.replace(/^Phòng\s+/iu, "");
    return rooms[0].note ? `${code}, ${lowerFirst(rooms[0].note)}` : code;
  }
  return rooms.map((room) => room.title.replace(/^Phòng\s+/iu, "")).join(", ");
}

function derivePriceFromRooms(rooms) {
  if (!rooms.length) return "";
  if (rooms.length === 1) return rooms[0].price;
  return rooms.map((room) => `${room.title.replace(/^Phòng\s+/iu, "")}: ${room.price}`).join("; ");
}

export function summarizeRoomListing(rawInput) {
  const original = normalizeWhitespace(rawInput);
  const structured = parseLabeledListing(original);
  const cleanText = stripInternalDetails(original);
  const chunks = splitChunks(cleanText);

  const address = structured.fields.address
    ? cleanAddress(structured.fields.address)
    : extractAddress(cleanText, chunks);
  const availability = structured.fields.availability
    ? normalizeAvailability(structured.fields.availability)
    : "";
  const price = structured.fields.price
    ? normalizePrice(structured.fields.price, { monthly: true })
    : "";
  const fallbackRooms = extractRooms(chunks, address);
  const rooms = availability || price
    ? roomsFromStructuredFields(availability, price)
    : fallbackRooms;
  const roomType = structured.fields.roomType
    ? normalizeRoomType(structured.fields.roomType)
    : extractRoomType(chunks);
  const stairs = structured.fields.stairs
    ? normalizeStairs(structured.fields.stairs)
    : extractStairs(chunks);
  const furniture = structured.fields.furniture
    ? normalizeFurniture(structured.fields.furniture)
    : extractFurniture(chunks);
  const services = extractServices(structured.fields.services || cleanText);

  const used = new Set([
    address,
    availability,
    price,
    roomType,
    furniture,
    ...rooms.flatMap((room) => [room.title, room.price, room.note]),
    ...services.flatMap((service) => [service.label, service.value]),
  ].filter(Boolean));

  const structuredNotes = structured.notes
    .map(normalizeNote)
    .filter(Boolean);
  const notes = structuredNotes.length
    ? [...new Set(structuredNotes)].slice(0, 8)
    : extractNotes(chunks, used);

  const displayAvailability = availability || deriveAvailabilityFromRooms(rooms);
  const displayPrice = price || derivePriceFromRooms(rooms);

  return {
    address,
    availability: displayAvailability,
    price: displayPrice,
    rooms,
    roomType,
    stairs,
    furniture,
    services,
    notes,
    isEmpty: !address && !displayAvailability && !displayPrice && !roomType && !stairs && !furniture && !services.length && !notes.length,
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

function appendDetailRow(container, label, value, editable) {
  if (!value) return;
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const labelNode = document.createElement("strong");
  labelNode.textContent = `${label}:`;
  const valueNode = editableText("span", "room-share-detail-value", value);
  valueNode.contentEditable = String(editable);
  row.append(labelNode, document.createTextNode(" "), valueNode);
  container.append(row);
}

function renderListSection(container, title, className, items, editable, renderItem) {
  if (!items.length) return;
  const section = document.createElement("section");
  section.className = "room-share-section";
  const heading = document.createElement("h4");
  heading.className = "room-share-section-title";
  heading.textContent = `${title}:`;
  const list = document.createElement("ul");
  list.className = className;

  for (const item of items) {
    const listItem = document.createElement("li");
    renderItem(listItem, item, editable);
    list.append(listItem);
  }

  section.append(heading, list);
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

  const details = document.createElement("div");
  details.className = "room-share-details";
  appendDetailRow(details, "Địa chỉ", summary.address || "Địa chỉ chưa rõ", editable);
  appendDetailRow(details, "Phòng trống", summary.availability, editable);
  appendDetailRow(details, "Giá", summary.price, editable);
  appendDetailRow(details, "Dạng phòng", summary.roomType, editable);
  appendDetailRow(details, "Thang máy", summary.stairs, editable);
  appendDetailRow(details, "Nội thất", summary.furniture, editable);
  container.append(details);

  renderListSection(container, "Dịch vụ", "room-share-services", summary.services, editable, (item, service, canEdit) => {
    const label = document.createElement("strong");
    label.textContent = `${service.label}:`;
    const value = editableText("span", "room-share-service-value", service.value);
    value.contentEditable = String(canEdit);
    item.append(label, document.createTextNode(" "), value);
  });

  renderListSection(container, "Lưu ý", "room-share-notes", summary.notes, editable, (item, note, canEdit) => {
    const value = editableText("span", "room-share-note-value", note);
    value.contentEditable = String(canEdit);
    item.append(value);
  });
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
