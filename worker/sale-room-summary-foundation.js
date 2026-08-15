export const MAX_SOURCE_LENGTH = 12000;
export const MAX_ADDRESS_LENGTH = 320;
export const MAX_ROOMS = 24;
export const MAX_ITEMS = 24;
export const MAX_SERVICE_ITEMS = 16;

export function fold(value) {
  return String(value ?? "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clean(value, max = 320) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’•·*☘🌷🏢⌛⭐🏆-]+/u, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim()
    .slice(0, max);
}

export function normalizeRoomSummarySource(value) {
  const text = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[\t\u00a0]+/g, " ");
  return text
    .split("\n")
    .map((line) => line.replace(/[ ]{2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_SOURCE_LENGTH);
}

export const normalizeRoomAddressSource = normalizeRoomSummarySource;

export function normalizeDetectedAddress(value) {
  return clean(value, MAX_ADDRESS_LENGTH)
    .replace(/^(?:địa\s*chỉ|dia\s*chi|đc|dc|address)\s*[:：-]?\s*/iu, "")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s*:\s*/g, ": ")
    .replace(/[.!?]+$/g, "")
    .trim()
    .slice(0, MAX_ADDRESS_LENGTH);
}

export function phraseGrounded(sourceValue, candidateValue) {
  const source = fold(sourceValue);
  const candidate = fold(candidateValue);
  return Boolean(source && candidate && (` ${source} `).includes(` ${candidate} `));
}

export function addressIsGroundedInSource(sourceValue, addressValue) {
  return phraseGrounded(sourceValue, addressValue);
}

export function extractSourceAddress(sourceValue) {
  const source = normalizeRoomSummarySource(sourceValue);
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/^[^\p{L}\p{N}]+/u, "");
    const match = line.match(/^(?:địa\s*chỉ|dia\s*chi|đc|dc|address)\s*[:：=-]\s*(.+)$/iu);
    if (!match) continue;
    let address = normalizeDetectedAddress(match[1]);
    const next = String(lines[i + 1] || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (
      next
      && /^(?:quận|quan|q\.?|phường|phuong|p\.?|đường|duong|ngõ|ngo|hẻm|hem)\s*[:：-]?/iu.test(next)
      && !/^(?:giá|gia|trống|trong|phòng|phong|dịch\s*vụ|dich\s*vu|nội\s*thất|noi\s*that|thang)\b/iu.test(next)
    ) {
      const combined = normalizeDetectedAddress(`${address} - ${next}`);
      if (addressIsGroundedInSource(source, combined)) address = combined;
    }
    if (address && addressIsGroundedInSource(source, address)) return address;
  }
  return "";
}

export function canonicalRoomType(value) {
  const normalized = fold(value);
  if (!normalized) return "";
  if (normalized === "don") return "Đơn";
  if (normalized === "gac xep") return "Gác xép";
  if (normalized === "studio" || normalized === "stuido") return "Studio";
  const match = normalized.match(/^([1-9]\d*)\s*n\s*1\s*k$/u);
  return match ? `${Number(match[1])}N1K` : "";
}

function roomTypesInSource(sourceValue) {
  const source = fold(sourceValue);
  const found = new Set();
  if (/(?:^|\s)don(?:\s|$)/u.test(source)) found.add("Đơn");
  if (/(?:^|\s)gac xep(?:\s|$)/u.test(source)) found.add("Gác xép");
  if (/(?:^|\s)(?:studio|stuido)(?:\s|$)/u.test(source)) found.add("Studio");
  for (const match of source.matchAll(/(?:^|\s)([1-9]\d*)\s*n\s*1\s*k(?:\s|$)/gu)) {
    found.add(`${Number(match[1])}N1K`);
  }
  return found;
}

export function normalizeDetectedRoomType(sourceValue, value) {
  const candidate = canonicalRoomType(value);
  const found = roomTypesInSource(sourceValue);
  return candidate && found.size === 1 && found.has(candidate) ? candidate : "";
}

export function extractSourceRoomType(sourceValue) {
  const found = roomTypesInSource(sourceValue);
  return found.size === 1 ? [...found][0] : "";
}

export function canonicalElevator(value) {
  const normalized = fold(value);
  if (/^(?:co|yes|true|co thang may|thang may|elevator)$/u.test(normalized)) return "Có";
  if (/^(?:khong|no|false|khong co|khong co thang may|khong thang may|thang bo)$/u.test(normalized)) return "Không";
  return "";
}

export function splitClauses(value) {
  const protectedText = String(value ?? "").replace(/(\d),(\d)/g, "$1§$2");
  return protectedText
    .split(/[\n;,|•.!?]+/u)
    .map((part) => part.replace(/§/g, ",").trim())
    .filter(Boolean);
}

export function elevatorStatusInSource(sourceValue) {
  let yes = false;
  let no = false;
  for (const clause of splitClauses(sourceValue).map(fold)) {
    if (/(?:^|\s)(?:khong co thang may|khong thang may|thang may khong(?: co)?|no elevator|without elevator|thang bo)(?:\s|$)/u.test(clause)) {
      no = true;
      continue;
    }
    if (/(?:^|\s)(?:thang may|elevator)(?:\s|$)/u.test(clause)) yes = true;
  }
  return yes === no ? "" : yes ? "Có" : "Không";
}

export function normalizeDetectedElevator(sourceValue, value) {
  const candidate = canonicalElevator(value);
  return candidate && elevatorStatusInSource(sourceValue) === candidate ? candidate : "";
}

export function furnitureReferencesImage(sourceValue) {
  const source = fold(sourceValue);
  return /(?:^|\s)(?:noi that|full do|do dac|trang bi)(?:\s+[a-z0-9]+){0,8}\s+(?:nhu anh|nhu hinh)(?:\s|$)/u.test(source)
    || /(?:^|\s)(?:nhu anh|nhu hinh)(?:\s+[a-z0-9]+){0,8}\s+(?:noi that|full do|do dac|trang bi)(?:\s|$)/u.test(source);
}

const FURNITURE_ALIASES = Object.freeze([
  ["tủ quần áo", /(?:^|\s)(?:tu quan ao|tu ao)(?:\s|$)/u],
  ["nóng lạnh", /(?:^|\s)(?:binh nong lanh|nong lanh)(?:\s|$)/u],
  ["điều hòa", /(?:^|\s)(?:dieu hoa|may lanh|dhoa|dh)(?:\s|$)/u],
  ["máy sấy", /(?:^|\s)may say(?:\s|$)/u],
  ["máy giặt", /(?:^|\s)may giat(?:\s+rieng)?(?:\s|$)/u],
  ["tủ bếp", /(?:^|\s)tu bep(?:\s|$)/u],
  ["bếp từ", /(?:^|\s)bep tu(?:\s|$)/u],
  ["tủ lạnh", /(?:^|\s)tu lanh(?:\s|$)/u],
  ["bàn trang điểm", /(?:^|\s)ban trang diem(?:\s|$)/u],
  ["bàn bếp", /(?:^|\s)ban bep(?:\s|$)/u],
  ["bàn làm việc", /(?:^|\s)ban lam viec(?:\s|$)/u],
  ["bàn ăn", /(?:^|\s)ban an(?:\s|$)/u],
  ["bàn ghế", /(?:^|\s)ban ghe(?:\s|$)/u],
  ["giường", /(?:^|\s)giuong(?:\s|$)/u],
  ["sofa", /(?:^|\s)sofa(?:\s|$)/u],
  ["rèm", /(?:^|\s)rem(?:\s|$)/u],
  ["tivi", /(?:^|\s)(?:tivi|tv)(?:\s|$)/u],
  ["đệm", /(?:^|\s)(?:dem|nem)(?:\s|$)/u],
  ["kệ", /(?:^|\s)ke(?:\s|$)/u],
  ["bàn", /(?:^|\s)ban(?:\s|$)/u],
  ["ghế", /(?:^|\s)ghe(?:\s|$)/u],
  ["tủ", /(?:^|\s)tu(?:\s|$)/u],
]);

function furnitureDisplay(items) {
  const output = [];
  const seen = new Set();
  for (const raw of items) {
    const value = String(raw || "").trim();
    const key = fold(value);
    if (!value || !key || seen.has(key)) continue;
    if (key === "tu" && [...seen].some((seenKey) => seenKey.startsWith("tu "))) continue;
    if (key === "ban" && [...seen].some((seenKey) => seenKey.startsWith("ban "))) continue;
    if (key === "ghe" && seen.has("ban ghe")) continue;
    seen.add(key);
    output.push(value);
  }
  if (!output.length) return "";
  const joined = output.join(", ");
  return joined.charAt(0).toLocaleUpperCase("vi") + joined.slice(1);
}

function canonicalFurnitureCandidate(value) {
  const normalized = fold(value);
  if (!normalized || /^(?:dien|nuoc|mang|internet|wifi|thang may|thang bo|studio|stuido|don|gac xep|vskk|ve sinh khep kin|camera|bao ve)$/u.test(normalized)) {
    return "";
  }
  for (const [label, pattern] of FURNITURE_ALIASES) {
    if (pattern.test(` ${normalized} `)) return label;
  }
  return clean(value, 90).toLocaleLowerCase("vi");
}

export function normalizeDetectedFurniture(sourceValue, itemValues, asImage = false) {
  if (furnitureReferencesImage(sourceValue)) return "Như hình";
  if (asImage === true || !Array.isArray(itemValues)) return "";
  const items = [];
  for (const raw of itemValues.slice(0, MAX_ITEMS)) {
    for (const chunk of String(raw ?? "").split(/[,;+/]+/u)) {
      const candidate = clean(chunk, 90)
        .replace(/^(?:nội\s*thất|noi\s*that|furniture|đồ\s*đạc|do\s*dac|trang\s*bị|trang\s*bi)\s*[:：-]?\s*/iu, "")
        .trim();
      if (!candidate || !phraseGrounded(sourceValue, candidate)) continue;
      const canonical = canonicalFurnitureCandidate(candidate);
      if (canonical) items.push(canonical);
    }
  }
  return furnitureDisplay(items);
}

const SOURCE_FURNITURE_ALIASES = Object.freeze([
  ["tủ quần áo", /(?<![\p{L}\p{N}_])(?:tủ\s+quần\s+áo|tủ\s+áo|tu\s+quan\s+ao|tu\s+ao)(?![\p{L}\p{N}_])/iu],
  ["nóng lạnh", /(?<![\p{L}\p{N}_])(?:bình\s+nóng\s+lạnh|nóng\s+lạnh|binh\s+nong\s+lanh|nong\s+lanh)(?![\p{L}\p{N}_])/iu],
  ["điều hòa", /(?<![\p{L}\p{N}_])(?:điều\s+hòa|điều\s+hoà|máy\s+lạnh|dieu\s+hoa|may\s+lanh|đhòa|dhoa|đh|dh)(?![\p{L}\p{N}_])/iu],
  ["máy sấy", /(?<![\p{L}\p{N}_])(?:máy\s+sấy|may\s+say)(?![\p{L}\p{N}_])/iu],
  ["máy giặt riêng", /(?<![\p{L}\p{N}_])(?:máy\s+giặt\s+riêng|may\s+giat\s+rieng)(?![\p{L}\p{N}_])/iu],
  ["máy giặt", /(?<![\p{L}\p{N}_])(?:máy\s+giặt|may\s+giat)(?!\s+(?:chung|riêng|rieng))(?![\p{L}\p{N}_])/iu],
  ["tủ bếp", /(?<![\p{L}\p{N}_])(?:tủ\s+bếp|tu\s+bep)(?![\p{L}\p{N}_])/iu],
  ["bếp từ", /(?<![\p{L}\p{N}_])(?:bếp\s+từ|bep\s+tu)(?![\p{L}\p{N}_])/iu],
  ["tủ lạnh", /(?<![\p{L}\p{N}_])(?:tủ\s+lạnh|tu\s+lanh)(?![\p{L}\p{N}_])/iu],
  ["bàn trang điểm", /(?<![\p{L}\p{N}_])(?:bàn\s+trang\s+điểm|ban\s+trang\s+diem)(?![\p{L}\p{N}_])/iu],
  ["bàn bếp", /(?<![\p{L}\p{N}_])(?:bàn\s+bếp|ban\s+bep)(?![\p{L}\p{N}_])/iu],
  ["bàn làm việc", /(?<![\p{L}\p{N}_])(?:bàn\s+làm\s+việc|ban\s+lam\s+viec)(?![\p{L}\p{N}_])/iu],
  ["bàn ăn", /(?<![\p{L}\p{N}_])(?:bàn\s+ăn|ban\s+an)(?![\p{L}\p{N}_])/iu],
  ["bàn ghế", /(?<![\p{L}\p{N}_])(?:bàn\s+ghế|ban\s+ghe)(?![\p{L}\p{N}_])/iu],
  ["giường", /(?<![\p{L}\p{N}_])(?:giường|giuong)(?![\p{L}\p{N}_])/iu],
  ["sofa", /(?<![\p{L}\p{N}_])sofa(?![\p{L}\p{N}_])/iu],
  ["rèm", /(?<![\p{L}\p{N}_])(?:rèm|rem)(?![\p{L}\p{N}_])/iu],
  ["tivi", /(?<![\p{L}\p{N}_])(?:tivi|tv)(?![\p{L}\p{N}_])/iu],
  ["đệm", /(?<![\p{L}\p{N}_])(?:đệm|nệm|dem|nem)(?![\p{L}\p{N}_])/iu],
  ["kệ", /(?<![\p{L}\p{N}_])(?:kệ|ke)(?![\p{L}\p{N}_])/iu],
  ["bàn", /(?<![\p{L}\p{N}_])(?:bàn|ban)(?![\p{L}\p{N}_])/iu],
  ["ghế", /(?<![\p{L}\p{N}_])(?:ghế|ghe)(?![\p{L}\p{N}_])/iu],
  ["tủ", /(?<![\p{L}\p{N}_])(?:tủ|tu)(?![\p{L}\p{N}_])/iu],
]);

export function extractSourceFurniture(sourceValue) {
  const source = normalizeRoomSummarySource(sourceValue);
  if (furnitureReferencesImage(source)) return "Như hình";
  const relevant = source
    .split("\n")
    .filter((line) => /(?:nội\s*thất|noi\s*that|đồ\s*đạc|do\s*dac|trang\s*bị|trang\s*bi|furniture)/iu.test(line));
  if (!relevant.length) return "";

  const values = [];
  for (const line of relevant) {
    if (/(?<![\p{L}\p{N}_])(?:full\s*đồ|full\s*do)(?![\p{L}\p{N}_])/iu.test(line)) values.push("full đồ");
    const matches = [];
    for (const [label, pattern] of SOURCE_FURNITURE_ALIASES) {
      const match = pattern.exec(line);
      if (match) matches.push({ index: match.index ?? 0, label });
    }
    matches.sort((a, b) => a.index - b.index || b.label.length - a.label.length);
    for (const match of matches) {
      if (match.label === "máy giặt" && /(?:máy\s+giặt|may\s+giat)\s+chung/iu.test(line)) continue;
      values.push(match.label);
    }
  }
  return furnitureDisplay(values);
}

export function sourceLines(value) {
  return normalizeRoomSummarySource(value).split(/\n+/u).map((line) => line.trim()).filter(Boolean);
}
