const INTERNAL_PHRASES = [
  /(?:hoa\s*hồng|hoa\s*hong|commission)\s*[:\-]?\s*\d+(?:[.,]\d+)?\s*%?/giu,
  /\b(?:hh)\s*[:\-]?\s*\d+(?:[.,]\d+)?\s*%/giu,
  /\b(?:liên\s*hệ|lien\s*he|contact|zalo|sđt|sdt|phone)\s*[:\-]?\s*(?:\+?84|0)?(?:[\s.\-]?\d){8,10}/giu,
  /\b(?:nguồn|nguon)\s*[:\-]?\s*[^,;|\n]*/giu,
];

const PHONE_PATTERN = /(?<![\p{L}\p{N}.\-])(?:\+?84|0)(?:[\s.\-]?\d){8,10}(?!\d)/gu;
const URL_PATTERN = /https?:\/\/\S+|www\.\S+/giu;
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\uFE0F/gu;
const PRICE_SOURCE = String.raw`\d+(?:[.,]\d+)?\s*(?:tr(?:\d+)?|triệu|trieu|k|nghìn|nghin|vnđ|vnd|đ)(?:\s*\/\s*(?:tháng|thang))?`;
const PRICE_PATTERN = new RegExp(`\\b${PRICE_SOURCE}`, "iu");
const PRICE_ONLY_PATTERN = new RegExp(`^${PRICE_SOURCE}$`, "iu");

const SERVICE_DEFINITIONS = [
  { key: "electricity", label: "Điện", patterns: ["điện", "dien"] },
  { key: "water", label: "Nước", patterns: ["nước", "nuoc"] },
  { key: "internet", label: "Mạng", patterns: ["internet", "wifi", "wi-fi", "mạng", "mang"] },
  { key: "common", label: "Dịch vụ chung", patterns: ["dịch vụ chung", "dich vu chung", "phí dịch vụ", "phi dich vu", "dvc", "vsinh", "vệ\\s*sinh", "ve\\s*sinh"] },
  { key: "parking", label: "Gửi xe", patterns: ["gửi\\s+xe", "gui\\s+xe", "để\\s+xe", "de\\s+xe", "free\\s+\\d+\\s+xe", "miễn phí\\s+\\d+\\s+xe", "mien phi\\s+\\d+\\s+xe", "xe(?=\\s*[:\\-]?\\s*\\d)"] },
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
  ["dia chi", "address"], ["dc", "address"], ["address", "address"], ["toa nha", "address"],
  ["trong", "availability"], ["phong trong", "availability"], ["con phong", "availability"], ["phong", "availability"],
  ["gia", "price"], ["gia phong", "price"],
  ["dang phong", "roomType"], ["loai phong", "roomType"],
  ["thang", "stairs"], ["thang may", "stairs"],
  ["noi that", "furniture"],
  ["dich vu", "services"], ["phi dich vu", "services"],
  ["luu y", "notes"], ["ghi chu", "notes"],
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
    .flatMap((line) => line.split(/\s*,\s*(?=(?:phòng|phong|p\.?\s*\d+|tầng|tang|điện|dien|nước|nuoc|wifi|internet|mạng|mang|dvc|gửi xe|gui xe|để xe|de xe|cọc|coc|hợp đồng|hop dong|không chung chủ|khong chung chu|pet|ban công|ban cong|cửa sổ|cua so|thang|nội thất|noi that)(?![\p{L}\p{N}]))/iu))
    .map((item) => item.trim().replace(/^[,.\-:\s]+|[,.\-:\s]+$/g, ""))
    .filter(Boolean);
}

function appendStructuredField(fields, field, value) {
  if (!value) return;
  fields[field] = fields[field] ? `${fields[field]}\n${value}` : value;
}

function parseLabeledListing(value) {
  const fields = {};
  const notes = [];
  let currentSection = "";
  let recognizedFieldCount = 0;

  for (const rawLine of normalizeWhitespace(value).split("\n")) {
    const line = stripDecorations(rawLine);
    if (!line || isInternalLine(line)) continue;

    const reverseAvailability = line.match(/^(\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?)\s+(?:trống|trong)\s*[:：]?\s*(.*)$/iu);
    if (reverseAvailability) {
      currentSection = "availability";
      recognizedFieldCount += 1;
      const date = reverseAvailability[1].replace(/\s*\/\s*/g, "/");
      const detail = stripDecorations(reverseAvailability[2]);
      appendStructuredField(fields, "availability", detail ? `${date} ${detail}` : date);
      continue;
    }

    const loosePrice = line.match(/^(?:giá|gia)(?:\s+(?:phòng|phong))?[ \t]+(?![:：])(.+)$/iu);
    if (loosePrice && PRICE_PATTERN.test(loosePrice[1])) {
      currentSection = "price";
      recognizedFieldCount += 1;
      appendStructuredField(fields, "price", stripDecorations(loosePrice[1]));
      continue;
    }

    const labeled = line.match(/^([^:：]{1,36})\s*[:：]\s*(.*)$/u);
    if (labeled) {
      const label = normalizeSearch(labeled[1]).replace(/\s+/g, " ").trim();
      const field = LABELED_FIELDS.get(label);
      if (!field) {
        if (currentSection === "address" && /^(?:quận|quan|huyện|huyen|phường|phuong|xã|xa|thành phố|thanh pho|tỉnh|tinh)\b/iu.test(line)) {
          const continuation = capitalizeFirst(line);
          fields.address = fields.address ? `${fields.address} - ${continuation}` : continuation;
        } else if (["services", "furniture", "price", "notes"].includes(currentSection)) {
          const continuation = stripDecorations(line);
          if (currentSection === "notes") notes.push(continuation);
          else appendStructuredField(fields, currentSection, continuation);
        } else {
          currentSection = "";
        }
        continue;
      }
      recognizedFieldCount += 1;
      const fieldValue = stripDecorations(labeled[2]);
      currentSection = field;
      if (field === "notes") {
        if (fieldValue) notes.push(fieldValue);
      } else if (fieldValue) {
        appendStructuredField(fields, field, fieldValue);
      }
      continue;
    }

    if (currentSection === "notes") notes.push(line);
    else if (currentSection === "furniture"
      && /\b(?:điện|dien|nước|nuoc|wifi|internet|mạng|mang|dịch vụ|dich vu|gửi xe|gui xe|để xe|de xe|cọc|coc|hợp đồng|hop dong)\b/iu.test(line)) {
      currentSection = "";
    } else if (["services", "furniture", "price"].includes(currentSection)) {
      appendStructuredField(fields, currentSection, line);
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
    && !/\b(?:điện|dien|nước|nuoc|wifi|internet|mạng|mang)\b/iu.test(chunk));
  return candidate ? cleanAddress(candidate) : "";
}

function compactText(value) {
  return normalizeWhitespace(String(value || "")
    .replace(/^(?:còn phòng|con phong|phòng trống|phong trong|còn|con)\s*[:\-]?\s*/iu, "")
    .replace(/\bgiá\s*[:\-]?\s*/giu, "")
    .replace(/\b(?:hoa\s*hồng|hoa\s*hong|hh)\b.*$/giu, ""));
}

function normalizePrice(value, { monthly = false, preserveDetails = false } = {}) {
  let clean = normalizeWhitespace(value)
    .replace(/(\d+(?:[.,]\d+)?)\s*triệu/giu, (_, amount) => `${amount.replace(",", ".")}tr`)
    .replace(/(\d+(?:[.,]\d+)?)\s*trieu/giu, (_, amount) => `${amount.replace(",", ".")}tr`)
    .replace(/(\d)\s+tr\b/giu, "$1tr")
    .replace(/\s*\/\s*/g, "/")
    .trim();
  if (monthly && clean && !/\/(?:tháng|thang)\b/iu.test(clean)) {
    const oneSimplePrice = PRICE_ONLY_PATTERN.test(clean);
    if (!preserveDetails || oneSimplePrice) clean = `${clean}/tháng`;
  }
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
  return clean.split(/\s*,\s*/u).filter(Boolean)
    .map((part, index) => index === 0 ? capitalizeFirst(part) : lowerFirst(part))
    .join(", ");
}

function expandCompositeServiceLabels(value) {
  return String(value || "").replace(
    /\b(?:vsinh|vệ\s*sinh|ve\s*sinh)\s*((?:\+\s*[^:+,;\n]+)+)\s*:\s*([^,;\n]+)/giu,
    (_, extraItems, amount) => {
      const details = ["vệ sinh", ...extraItems.split("+").map((item) => item.trim()).filter(Boolean)];
      return `Dịch vụ chung ${amount.trim()} (${details.join(", ")})`;
    },
  );
}

function normalizeCommaSpacing(value) {
  const placeholder = "__JOY_DECIMAL_COMMA__";
  return String(value || "")
    .replace(/(\d),(\d)/g, `$1${placeholder}$2`)
    .replace(/\s*,\s*/g, ", ")
    .replaceAll(placeholder, ",");
}

function compactThousands(value) {
  return String(value || "").replace(/\b(\d{4,6})\b/gu, (match, amount) => {
    const number = Number(amount);
    return number >= 1000 && number % 1000 === 0 ? `${number / 1000}k` : match;
  });
}

function normalizePunctuationSpacing(value) {
  const decimalComma = "__JOY_DECIMAL_COMMA__";
  return normalizeWhitespace(value)
    .split("\n")
    .map((line) => line
      .replace(/(\d),(\d)/g, `$1${decimalComma}$2`)
      .replace(/\s*\/\s*/g, "/")
      .replace(/\s+([,;:!?])/g, "$1")
      .replace(/([,;:])(?=\S)/g, "$1 ")
      .replaceAll(decimalComma, ",")
      .replace(/\s{2,}/g, " ")
      .trim())
    .filter(Boolean)
    .join("\n");
}

function capitalizeDisplayValue(value) {
  return normalizePunctuationSpacing(value)
    .split("\n")
    .map((line) => /^\p{Ll}/u.test(line) ? capitalizeFirst(line) : line)
    .join("\n");
}

function ensureDefaultUtilityUnit(key, value) {
  const defaultUnit = key === "electricity" ? "/số" : key === "water" ? "/khối" : "";
  if (!defaultUnit) return value;
  const clean = String(value || "").trim();
  const amount = clean.match(/^(\d+(?:[.,]\d+)?(?:k\d*|tr\d*|nghìn|nghin|vnđ|vnd|đ)?)(\s*\/[^\s,;()]+)?/iu);
  if (!amount || amount[2]) return clean;
  return `${amount[1]}${defaultUnit}${clean.slice(amount[1].length)}`;
}

function normalizeServiceValue(key, value) {
  let clean = normalizeWhitespace(value)
    .replace(/^[,.;:+\-\s]+|[,.;:+\-\s]+$/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")")
    .replace(/\s+/g, " ")
    .trim();
  clean = compactThousands(normalizeCommaSpacing(clean))
    .replace(/\/phong\b/giu, "/phòng")
    .replace(/\/thang\b/giu, "/tháng");

  if (key === "electricity") {
    clean = clean.replace(/\b(\d{1,2}[,.]\d{1,2})(?=\/(?:số|so)(?:\s|$))/giu, "$1k");
  }
  if (key === "water") clean = clean.replace(/\/m3\b/giu, "/m³");
  if (["common", "laundry"].includes(key)) {
    clean = clean
      .replace(/\/ng(?![\p{L}\p{N}])/giu, "/người")
      .replace(/\/nguoi\b/giu, "/người");
  }
  if (key === "parking") {
    const startsWithFree = /^free\b/iu.test(clean);
    clean = clean
      .replace(/\s*\(\s*/g, ", ")
      .replace(/\s*\)\s*/g, "")
      .replace(/\bxe\s*t\s*(\d+)\b/giu, "xe thứ $1")
      .replace(/\bfree\b/giu, startsWithFree ? "Free" : "miễn phí")
      .replace(/\.+(?=\s*,|$)/g, "")
      .replace(/\s*,\s*/g, ", ");
    clean = capitalizeFirst(clean);
  }
  clean = ensureDefaultUtilityUnit(key, clean);
  return normalizePunctuationSpacing(clean);
}

function isInsideParentheses(value, index) {
  let depth = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (value[cursor] === "(") depth += 1;
    if (value[cursor] === ")" && depth > 0) depth -= 1;
  }
  return depth > 0;
}

function trimUnstructuredServiceTail(value) {
  return String(value || "").replace(
    /(?:[;\n]\s*)(?=(?:cọc|coc|hợp đồng|hop dong|lưu ý|luu y|ghi chú|ghi chu|pet|thú cưng|thu cung|không chung chủ|khong chung chu)\b)[\s\S]*$/iu,
    "",
  );
}

function extractServices(serviceText, { stopAtGeneralNotes = false } = {}) {
  const text = normalizeWhitespace(expandCompositeServiceLabels(stripInternalDetails(serviceText)))
    .replace(/^(?:dịch vụ|dich vu|phí dịch vụ|phi dich vu)\s*[:\-]?\s*/iu, "");
  if (!text) return [];

  const markerMatches = [];
  for (const definition of SERVICE_DEFINITIONS) {
    for (const source of definition.patterns) {
      const matcher = new RegExp(`(?<![\\p{L}\\p{N}])(${source})(?![\\p{L}\\p{N}])\\s*[:+\\-]?\\s*`, "giu");
      for (const match of text.matchAll(matcher)) {
        const index = Number(match.index);
        if (isInsideParentheses(text, index)) continue;
        if (definition.key === "electricity" && /\bxe\s*$/iu.test(text.slice(Math.max(0, index - 6), index))) continue;
        markerMatches.push({ key: definition.key, label: definition.label, index, end: index + match[0].length, marker: match[1] });
      }
    }
  }
  markerMatches.sort((a, b) => a.index - b.index || b.end - a.end);
  const markers = markerMatches.filter((marker, index) => index === 0 || marker.index !== markerMatches[index - 1].index);
  const services = [];

  markers.forEach((marker, index) => {
    const nextIndex = index + 1 < markers.length ? markers[index + 1].index : text.length;
    let value = text.slice(marker.end, nextIndex);
    if (stopAtGeneralNotes) value = trimUnstructuredServiceTail(value);
    if (marker.key === "parking" && /^(?:free|miễn phí|mien phi)/iu.test(marker.marker)) value = `${marker.marker} ${value}`;
    value = normalizeServiceValue(marker.key, value);
    if (!value || value.length > 360) return;

    const existing = services.find((service) => service.key === marker.key);
    if (existing) {
      if (!normalizeSearch(existing.value).includes(normalizeSearch(value))) existing.value = `${existing.value}; ${value}`;
      return;
    }
    services.push({ key: marker.key, label: marker.label, value });
  });
  return services;
}

function humanizeKeyword(value) {
  const normalized = normalizeSearch(value);
  const labels = new Map([
    ["vao luon", "Có thể vào ở ngay"], ["o ngay", "Có thể vào ở ngay"], ["vao o ngay", "Có thể vào ở ngay"],
    ["san phong", "Phòng đang sẵn"], ["dau thang", "Có thể vào ở đầu tháng"], ["cuoi thang", "Có thể vào ở cuối tháng"],
  ]);
  return labels.get(normalized) || value.trim();
}

function extractRooms(cleanText) {
  const rooms = [];
  const seen = new Set();
  const matcher = new RegExp(`\\b(?:phòng\\s*|phong\\s*|p\\.?\\s*)([A-Za-z]*\\d[A-Za-z0-9./\\-]*)[ \\t]*(?:giá[ \\t]*[:\\-]?[ \\t]*)?(${PRICE_SOURCE})`, "giu");
  const availabilityKeyword = AVAILABILITY_KEYWORDS.find((keyword) => normalizeSearch(cleanText).includes(normalizeSearch(keyword))) || "";
  for (const match of cleanText.matchAll(matcher)) {
    const title = `Phòng ${match[1]}`;
    const price = normalizePrice(match[2]);
    const key = `${normalizeSearch(title)}|${normalizeSearch(price)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rooms.push({ title, price, note: availabilityKeyword ? humanizeKeyword(availabilityKeyword) : "" });
  }
  return rooms;
}

function extractGroupedPriceRooms(value) {
  const text = normalizeWhitespace(value);
  if (!text) return [];
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const usePrefix = lines.some((line) => /(?:^|[-–—,:\s])p\d{2,4}[a-z]?(?=$|[-–—,:\s])/iu.test(line));
  const groupPattern = new RegExp(`^(${PRICE_SOURCE})\\s*[-–—:]\\s*(.+)$`, "iu");
  const rooms = [];
  const seen = new Set();

  for (const line of lines) {
    const match = line.match(groupPattern);
    if (!match) continue;
    const price = normalizePrice(match[1]);
    const roomCodes = match[2].match(/\bP?\d{2,4}[A-Za-z]?\b/giu) || [];
    for (const rawCode of roomCodes) {
      const baseCode = rawCode.replace(/^P/iu, "");
      const code = usePrefix ? `P${baseCode}` : baseCode;
      const key = normalizeSearch(code);
      if (seen.has(key)) continue;
      seen.add(key);
      rooms.push({ title: `Phòng ${code}`, price, note: "" });
    }
  }
  return rooms;
}

function roomCode(room) {
  return String(room?.title || "").replace(/^Phòng\s+/iu, "").trim();
}

function priceSortValue(value) {
  const clean = normalizeSearch(value).replace(/\s+/g, "").replace(",", ".");
  const million = clean.match(/^(\d+)(?:\.(\d+))?tr(\d*)/u);
  if (million) {
    if (million[2]) return Number(`${million[1]}.${million[2]}`) * 1_000_000;
    if (million[3]) return Number(`${million[1]}.${million[3]}`) * 1_000_000;
    return Number(million[1]) * 1_000_000;
  }
  const thousand = clean.match(/^(\d+(?:\.\d+)?)k/u);
  return thousand ? Number(thousand[1]) * 1_000 : Number.POSITIVE_INFINITY;
}

function groupRoomsByPrice(rooms) {
  const groups = new Map();
  for (const room of rooms) {
    const price = String(room.price || "Chưa rõ giá").trim();
    const key = normalizeSearch(price);
    if (!groups.has(key)) groups.set(key, { price, rooms: [] });
    groups.get(key).rooms.push(roomCode(room));
  }
  return [...groups.values()].sort((a, b) => priceSortValue(a.price) - priceSortValue(b.price));
}

function availabilityMoment(value) {
  const clean = normalizePunctuationSpacing(stripDecorations(value)).replace(/\s*\/\s*/g, "/").trim();
  const normalized = normalizeSearch(clean);
  const date = clean.match(/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/u);
  if (date) return { key: `date:${date[0]}`, label: `Từ ${date[0]}`, summary: `Trống từ ${date[0]}` };
  if (/^(?:vao luon|o ngay|vao o ngay|co the vao o ngay)$/u.test(normalized)) {
    return { key: "now", label: "Vào luôn", summary: "Vào luôn" };
  }
  if (/^(?:dang trong|san phong|phong dang san)$/u.test(normalized)) {
    return { key: "available", label: "Đang trống", summary: "Đang trống" };
  }
  return clean ? { key: `text:${normalized}`, label: capitalizeFirst(clean), summary: capitalizeFirst(clean) } : null;
}

function resolveRoomCodes(value, rooms) {
  const known = new Map();
  let usesPrefix = false;
  for (const room of rooms) {
    const code = roomCode(room);
    if (/^P/iu.test(code)) usesPrefix = true;
    known.set(normalizeSearch(code.replace(/^P/iu, "")), code);
  }
  const matches = String(value || "").match(/\bP?\d{2,4}[A-Za-z]?\b/giu) || [];
  const result = [];
  for (const rawCode of matches) {
    const base = rawCode.replace(/^P/iu, "");
    const resolved = known.get(normalizeSearch(base)) || `${usesPrefix ? "P" : ""}${base}`;
    if (!result.some((code) => normalizeSearch(code) === normalizeSearch(resolved))) result.push(resolved);
  }
  return result;
}

function extractAvailabilityMoments(rawInput, rooms) {
  const dateSource = String.raw`\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?`;
  const immediateSource = String.raw`(?:vào\s*luôn|vao\s*luon|ở\s*ngay|o\s*ngay|vào\s*ở\s*ngay|vao\s*o\s*ngay|đang\s*trống|dang\s*trong|sẵn\s*phòng|san\s*phong)`;
  const patterns = [
    new RegExp(`^(${dateSource})\\s+(?:trống|trong)\\s*[:：-]?\\s*(.*)$`, "iu"),
    new RegExp(`^(${immediateSource})\\s*[:：-]?\\s*(.*)$`, "iu"),
    new RegExp(`^(?:trống|trong|phòng\\s*trống|phong\\s*trong)\\s*(?:từ|tu)?\\s*(${dateSource}|${immediateSource})\\s*[:：-]?\\s*(.*)$`, "iu"),
    new RegExp(`^(${dateSource})\\s*[:：-]\\s*(.*)$`, "iu"),
  ];
  const groups = new Map();

  for (const rawLine of normalizeWhitespace(rawInput).split("\n")) {
    const line = stripDecorations(rawLine);
    if (!line || isInternalLine(line)) continue;
    let match = null;
    for (const pattern of patterns) {
      match = line.match(pattern);
      if (match) break;
    }
    if (!match) continue;
    const moment = availabilityMoment(match[1].replace(/\s*\/\s*/g, "/"));
    if (!moment) continue;
    const codes = resolveRoomCodes(match[2], rooms);
    if (!groups.has(moment.key)) groups.set(moment.key, { ...moment, roomCodes: [] });
    const group = groups.get(moment.key);
    for (const code of codes) {
      if (!group.roomCodes.some((item) => normalizeSearch(item) === normalizeSearch(code))) group.roomCodes.push(code);
    }
  }
  return [...groups.values()];
}

function inferAvailabilityMoment(availability) {
  const text = String(availability || "");
  const date = text.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/u);
  if (date) return availabilityMoment(date[1]);
  const normalized = normalizeSearch(text);
  if (/vao luon|o ngay|vao o ngay/u.test(normalized)) return availabilityMoment("Vào luôn");
  if (/dang trong|san phong/u.test(normalized)) return availabilityMoment("Đang trống");
  return null;
}

function buildRoomPresentation(rawInput, rooms, availability) {
  if (!Array.isArray(rooms) || rooms.length < 2) return null;
  const priceGroups = groupRoomsByPrice(rooms);
  if (!priceGroups.length) return null;
  const moments = extractAvailabilityMoments(rawInput, rooms);

  if (moments.length <= 1) {
    const moment = moments[0] || inferAvailabilityMoment(availability);
    return {
      mode: "single",
      summary: `${rooms.length} phòng${moment?.summary ? ` · ${moment.summary}` : ""}`,
      priceGroups,
    };
  }

  const roomByCode = new Map(rooms.map((room) => [normalizeSearch(roomCode(room)), room]));
  const assigned = new Set();
  const groups = moments.map((moment) => {
    const groupedRooms = [];
    for (const code of moment.roomCodes) {
      const room = roomByCode.get(normalizeSearch(code));
      if (!room || assigned.has(normalizeSearch(roomCode(room)))) continue;
      groupedRooms.push(room);
      assigned.add(normalizeSearch(roomCode(room)));
    }
    return { label: moment.label, rooms: groupedRooms };
  });

  const unassigned = rooms.filter((room) => !assigned.has(normalizeSearch(roomCode(room))));
  const emptyGroups = groups.filter((group) => group.rooms.length === 0);
  if (unassigned.length && emptyGroups.length === 1) {
    emptyGroups[0].rooms.push(...unassigned);
    unassigned.length = 0;
  }
  if (unassigned.length) groups.push({ label: "Chưa rõ ngày trống", rooms: unassigned });

  const presentationGroups = groups
    .filter((group) => group.rooms.length)
    .map((group) => ({ label: group.label, priceGroups: groupRoomsByPrice(group.rooms) }));
  if (presentationGroups.length < 2) {
    const moment = moments[0] || inferAvailabilityMoment(availability);
    return {
      mode: "single",
      summary: `${rooms.length} phòng${moment?.summary ? ` · ${moment.summary}` : ""}`,
      priceGroups,
    };
  }
  return { mode: "multi", groups: presentationGroups };
}

function roomsFromStructuredFields(availability, price) {
  if (!availability && !price) return [];
  const roomCodes = [...String(availability || "").matchAll(/\bP?\d+[A-Za-z0-9/.\-]*\b/giu)]
    .map((match) => match[0])
    .filter((value) => !/^\d{1,2}\/\d{1,2}$/u.test(value));
  if (!roomCodes.length) return [{ title: "Phòng đang trống", price, note: availability }];
  const noteMatch = String(availability).match(/\btrống\s+(.+)$/iu);
  return roomCodes.map((code) => ({ title: `Phòng ${code}`, price, note: noteMatch ? `Trống ${noteMatch[1]}` : "" }));
}

function extractRoomType(text) {
  const keyword = ROOM_TYPE_KEYWORDS.find((item) => normalizeSearch(text).includes(normalizeSearch(item)));
  return keyword ? capitalizeFirst(keyword) : "";
}

function extractStairs(text) {
  const normalized = normalizeSearch(text);
  if (normalized.includes("khong thang may")) return "Không";
  if (normalized.includes("thang may")) return "Có";
  if (normalized.includes("thang bo") || normalized.includes("cau thang bo")) return "Không";
  return "";
}

function extractFurniture(chunks) {
  const matches = chunks.filter((chunk) => FURNITURE_KEYWORDS.some((keyword) => normalizeSearch(chunk).includes(normalizeSearch(keyword))));
  if (!matches.length) return "";
  const cleaned = matches.map((chunk) => compactText(chunk)
    .replace(/^(?:studio|1n1k|duplex|ccmn|chung cư mini|chung cu mini)\s*,?\s*/iu, "")
    .replace(/^(?:nội thất|noi that)\s*[:\-]?\s*/iu, "")
    .replace(/\b(?:thang máy|thang may|điện|dien|nước|nuoc|wifi|internet|mạng|mang|gửi xe|gui xe|để xe|de xe|cọc|coc)\b.*$/iu, "")
    .trim()).filter(Boolean);
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
  const stripped = stripDecorations(value).replace(/^[\-–—•·*]+\s*/u, "").trim();
  if (!stripped || /[:：]\s*$/u.test(stripped) || shouldHideNote(stripped)) return "";
  let clean = stripped.replace(/[.!]+$/g, "").trim();
  if (clean === clean.toUpperCase()) clean = clean.toLowerCase();
  clean = capitalizeFirst(normalizePunctuationSpacing(clean));
  return clean.replace(/^Không chung chủ giờ giấc tự do$/iu, "Không chung chủ, giờ giấc tự do");
}

function extractNotes(chunks) {
  const notes = [];
  for (const chunk of chunks) {
    if (shouldHideNote(chunk)) continue;
    const normalized = normalizeSearch(chunk);
    const roomChunk = (/\b(?:phong|p\.?|tang)\s*[a-z]*\d[a-z0-9./\-]*/iu.test(normalized)
      || normalized.includes("con phong") || normalized.includes("phong trong")) && PRICE_PATTERN.test(chunk);
    if (roomChunk || /\b(?:điện|dien|nước|nuoc|wifi|internet|mạng|mang|gửi xe|gui xe|để xe|de xe)\b/iu.test(chunk)) continue;
    if (NOTE_KEYWORDS.some((keyword) => normalized.includes(normalizeSearch(keyword)))
      || AVAILABILITY_KEYWORDS.some((keyword) => normalized.includes(normalizeSearch(keyword)))) {
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

function deriveGroupedAvailability(rooms, availability) {
  const codes = rooms.map((room) => room.title.replace(/^Phòng\s+/iu, "")).filter(Boolean);
  if (!codes.length) return availability;
  const detail = normalizeAvailability(availability);
  if (!detail) return codes.join(", ");
  if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/u.test(detail)) {
    return `${codes.join(", ")} (trống ${detail})`;
  }
  return detail;
}

function derivePriceFromRooms(rooms) {
  if (!rooms.length) return "";
  if (rooms.length === 1) return rooms[0].price;
  return rooms.map((room) => `${room.title.replace(/^Phòng\s+/iu, "")}: ${room.price}`).join("; ");
}

function polishRoomSummary(summary) {
  const services = (summary.services || [])
    .map((service) => ({ ...service, value: normalizeServiceValue(service.key, service.value) }))
    .filter((service) => service.value);
  const notes = (summary.notes || []).map(normalizeNote).filter(Boolean);
  const address = capitalizeDisplayValue(summary.address);
  const availability = capitalizeDisplayValue(summary.availability).replace(/\bp(?=\d)/giu, "P");
  const price = normalizePunctuationSpacing(summary.price).replace(/\bp(?=\d)/giu, "P");
  const roomType = capitalizeDisplayValue(summary.roomType);
  const stairs = capitalizeDisplayValue(summary.stairs);
  const furniture = capitalizeDisplayValue(summary.furniture);

  return {
    ...summary,
    address,
    availability,
    price,
    roomType,
    stairs,
    furniture,
    services,
    notes,
    isEmpty: !address && !availability && !price && !roomType && !stairs && !furniture && !services.length && !notes.length,
  };
}

export function summarizeRoomListing(rawInput) {
  const original = normalizeWhitespace(rawInput);
  const structured = parseLabeledListing(original);
  const cleanText = stripInternalDetails(original);
  const chunks = splitChunks(cleanText);
  const address = structured.fields.address ? cleanAddress(structured.fields.address) : extractAddress(cleanText, chunks);
  const availability = structured.fields.availability ? normalizeAvailability(structured.fields.availability) : "";
  const structuredPrice = structured.fields.price ? stripInternalDetails(structured.fields.price) : "";
  const price = structuredPrice ? normalizePrice(structuredPrice, { monthly: true, preserveDetails: true }) : "";
  const fallbackRooms = extractRooms(cleanText);
  const groupedPriceRooms = price ? extractGroupedPriceRooms(price) : [];
  const rooms = groupedPriceRooms.length
    ? groupedPriceRooms
    : availability || price
      ? roomsFromStructuredFields(availability, price)
      : fallbackRooms;
  const roomPresentation = buildRoomPresentation(original, rooms, availability);
  const roomType = structured.fields.roomType ? normalizeRoomType(structured.fields.roomType) : extractRoomType(cleanText);
  const stairs = structured.fields.stairs ? normalizeStairs(structured.fields.stairs) : extractStairs(cleanText);
  const furniture = structured.fields.furniture ? normalizeFurniture(structured.fields.furniture) : extractFurniture(chunks);
  const services = extractServices(structured.fields.services || cleanText, { stopAtGeneralNotes: !structured.fields.services });
  const structuredNotes = structured.notes.map(normalizeNote).filter(Boolean);
  const notes = structuredNotes.length ? [...new Set(structuredNotes)].slice(0, 8) : extractNotes(chunks);
  const displayAvailability = groupedPriceRooms.length
    ? deriveGroupedAvailability(groupedPriceRooms, availability)
    : availability || deriveAvailabilityFromRooms(rooms);
  const displayPrice = price || derivePriceFromRooms(rooms);
  return polishRoomSummary({
    address,
    availability: displayAvailability,
    price: displayPrice,
    rooms,
    roomPresentation,
    roomType,
    stairs,
    furniture,
    services,
    notes,
    isEmpty: false,
  });
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

function appendRoomPriceList(container, groups, editable) {
  const list = document.createElement("ul");
  list.className = "room-share-price-list";
  for (const group of groups) {
    const item = document.createElement("li");
    const price = editableText("strong", "room-share-price-value", group.price);
    price.contentEditable = String(editable);
    const rooms = editableText("span", "room-share-price-rooms", group.rooms.join(", "));
    rooms.contentEditable = String(editable);
    item.append(price, document.createTextNode(": "), rooms);
    list.append(item);
  }
  container.append(list);
}

function renderRoomPresentation(container, presentation, editable) {
  if (!presentation) return false;
  if (presentation.mode === "single") {
    appendDetailRow(container, "Phòng trống", presentation.summary, editable);
    const section = document.createElement("section");
    section.className = "room-share-room-pricing";
    const title = document.createElement("h4");
    title.textContent = "Giá phòng:";
    section.append(title);
    appendRoomPriceList(section, presentation.priceGroups, editable);
    container.append(section);
    return true;
  }

  const section = document.createElement("section");
  section.className = "room-share-room-pricing room-share-room-pricing-multi";
  const title = document.createElement("h4");
  title.textContent = "Phòng trống:";
  section.append(title);
  for (const group of presentation.groups) {
    const block = document.createElement("div");
    block.className = "room-share-availability-group";
    const heading = document.createElement("h5");
    heading.textContent = group.label;
    block.append(heading);
    appendRoomPriceList(block, group.priceGroups, editable);
    section.append(block);
  }
  container.append(section);
  return true;
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
  const hasRoomPresentation = renderRoomPresentation(details, summary.roomPresentation, editable);
  if (!hasRoomPresentation) {
    appendDetailRow(details, "Phòng trống", summary.availability, editable);
    appendDetailRow(details, "Giá", summary.price, editable);
  }
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
