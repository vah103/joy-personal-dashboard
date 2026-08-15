import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

export const SALE_ROOM_SUMMARY_AI_PATH = "/api/sales/room-summary/extract";
export const LEGACY_SALE_ROOM_ADDRESS_AI_PATH = "/api/sales/room-summary/address";
export const DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const MAX_SOURCE_LENGTH = 12000;
const MAX_ADDRESS_LENGTH = 320;
const MAX_ROOM_FIELD_LENGTH = 220;
const MAX_ROOMS = 24;
const MAX_FURNITURE_ITEMS = 24;
const MAX_SERVICE_ITEMS = 16;
const MAX_SERVICE_NAME_LENGTH = 90;
const MAX_SERVICE_VALUE_LENGTH = 90;
const MAX_SERVICE_EVIDENCE_LENGTH = 420;
const MAX_SERVICE_INCLUDES = 12;

const SERVICE_KINDS = new Set(["common", "internet", "parking", "cleaning", "washing", "other"]);
const RATE_SOURCE = String.raw`(?:\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|m|k|nghìn|nghin|đ|d|vnd)\s*\d*(?:\s*\/\s*(?:1\s*)?(?:ng|người|nguoi|phòng|phong|xe|tháng|thang|m3|m³|khối|khoi|số|so|kwh))?|\d+(?:[.,]\d+)?\s*\/\s*(?:1\s*)?(?:ng|người|nguoi|phòng|phong|xe|tháng|thang|m3|m³|khối|khoi|số|so|kwh)|(?:miễn\s+phí|mien\s+phi|free))`;
const COMMON_LABEL_SOURCE = String.raw`(?:phí\s+(?:dịch\s+vụ|dv)\s+chung|dịch\s+vụ\s+chung|dv\s+chung|phí\s+chung|phí\s+(?:dịch\s+vụ|dv)|dịch\s+vụ|dv)`;
const SHARED_UTILITY_LABEL_SOURCE = String.raw`(?:điện\s*(?:\+|&|và)?\s*nước|nước\s*(?:\+|&|và)?\s*điện)`;

const EXPLICIT_UNAVAILABLE_PATTERNS = Object.freeze([
  /\bda coc\b/u,
  /\bcoc roi\b/u,
  /\bda giu\b/u,
  /\bgiu roi\b/u,
  /\bda thue\b/u,
  /\bthue roi\b/u,
]);

const NON_FURNITURE_ITEM_PATTERNS = Object.freeze([
  /^(?:dien|nuoc|mang|internet|wifi|gui xe|phi gui xe|dich vu|phi dich vu)$/u,
  /^(?:thang may|thang bo|elevator)$/u,
  /^(?:studio|stuido|don|gac xep|\d+\s*n\s*1\s*k)$/u,
  /^(?:ban cong|cua so|gac|tang|dien tich|camera|bao ve)$/u,
]);

const FURNITURE_DEFINITIONS = Object.freeze([
  { value: "tủ quần áo", pattern: /(?<![\p{L}\p{N}_])(?:tủ\s+quần\s+áo|tủ\s+áo)(?![\p{L}\p{N}_])/iu },
  { value: "bình nóng lạnh", pattern: /(?<![\p{L}\p{N}_])(?:bình\s+nóng\s+lạnh|nóng\s+lạnh)(?![\p{L}\p{N}_])/iu },
  { value: "điều hòa", pattern: /(?<![\p{L}\p{N}_])(?:điều\s+hòa|điều\s+hoà|máy\s+lạnh)(?![\p{L}\p{N}_])/iu },
  { value: "máy hút mùi", pattern: /(?<![\p{L}\p{N}_])máy\s+hút\s+mùi(?![\p{L}\p{N}_])/iu },
  { value: "máy giặt", pattern: /(?<![\p{L}\p{N}_])máy\s+giặt(?!\s+chung)(?![\p{L}\p{N}_])/iu },
  { value: "lò vi sóng", pattern: /(?<![\p{L}\p{N}_])lò\s+vi\s+sóng(?![\p{L}\p{N}_])/iu },
  { value: "bàn làm việc", pattern: /(?<![\p{L}\p{N}_])bàn\s+làm\s+việc(?![\p{L}\p{N}_])/iu },
  { value: "bàn ăn", pattern: /(?<![\p{L}\p{N}_])bàn\s+ăn(?![\p{L}\p{N}_])/iu },
  { value: "bàn ghế", pattern: /(?<![\p{L}\p{N}_])bàn\s+ghế(?![\p{L}\p{N}_])/iu },
  { value: "tủ bếp", pattern: /(?<![\p{L}\p{N}_])tủ\s+bếp(?![\p{L}\p{N}_])/iu },
  { value: "bếp từ", pattern: /(?<![\p{L}\p{N}_])bếp\s+từ(?![\p{L}\p{N}_])/iu },
  { value: "tủ lạnh", pattern: /(?<![\p{L}\p{N}_])tủ\s+lạnh(?![\p{L}\p{N}_])/iu },
  { value: "giường", pattern: /(?<![\p{L}\p{N}_])giường(?![\p{L}\p{N}_])/iu },
  { value: "đệm", pattern: /(?<![\p{L}\p{N}_])(?:đệm|nệm)(?![\p{L}\p{N}_])/iu },
  { value: "sofa", pattern: /(?<![\p{L}\p{N}_])sofa(?![\p{L}\p{N}_])/iu },
  { value: "rèm", pattern: /(?<![\p{L}\p{N}_])rèm(?![\p{L}\p{N}_])/iu },
  { value: "tivi", pattern: /(?<![\p{L}\p{N}_])(?:tivi|tv)(?![\p{L}\p{N}_])/iu },
  { value: "kệ", pattern: /(?<![\p{L}\p{N}_])kệ(?![\p{L}\p{N}_])/iu },
  { value: "bàn", pattern: /(?<![\p{L}\p{N}_])bàn(?![\p{L}\p{N}_])/iu },
  { value: "ghế", pattern: /(?<![\p{L}\p{N}_])ghế(?![\p{L}\p{N}_])/iu },
  { value: "tủ", pattern: /(?<![\p{L}\p{N}_])tủ(?![\p{L}\p{N}_])/iu },
]);

const PACKAGE_MEMBER_PATTERNS = Object.freeze([
  { value: "Mạng", pattern: /(?<![\p{L}\p{N}_])(?:mạng|internet|wifi)(?![\p{L}\p{N}_])/iu },
  { value: "Vệ sinh", pattern: /(?<![\p{L}\p{N}_])(?:vệ\s+sinh|vs)(?![\p{L}\p{N}_])/iu },
  { value: "Rác", pattern: /(?<![\p{L}\p{N}_])(?:rác|rác\s+thải)(?![\p{L}\p{N}_])/iu },
  { value: "Máy giặt chung", pattern: /(?<![\p{L}\p{N}_])(?:máy\s+giặt(?:\s+chung)?|giặt\s+chung)(?![\p{L}\p{N}_])/iu },
  { value: "Gửi xe", pattern: /(?<![\p{L}\p{N}_])(?:gửi\s+xe|xe\s+máy|parking|phí\s+xe)(?![\p{L}\p{N}_])/iu },
  { value: "Điện chung", pattern: /(?<![\p{L}\p{N}_])(?:điện\s+chung|điện\s+hành\s+lang)(?![\p{L}\p{N}_])/iu },
  { value: "Nước chung", pattern: /(?<![\p{L}\p{N}_])nước\s+chung(?![\p{L}\p{N}_])/iu },
  { value: "Điện", pattern: /(?<![\p{L}\p{N}_])điện(?!\s+(?:chung|hành\s+lang))(?![\p{L}\p{N}_])/iu },
  { value: "Nước", pattern: /(?<![\p{L}\p{N}_])nước(?!\s+chung)(?![\p{L}\p{N}_])/iu },
  { value: "Camera", pattern: /(?<![\p{L}\p{N}_])camera(?![\p{L}\p{N}_])/iu },
  { value: "Bảo vệ", pattern: /(?<![\p{L}\p{N}_])bảo\s+vệ(?![\p{L}\p{N}_])/iu },
]);

const EXPLICIT_SERVICE_DEFINITIONS = Object.freeze([
  { kind: "internet", name: "Mạng", label: String.raw`(?:mạng|internet|wifi)` },
  { kind: "parking", name: "Gửi xe", label: String.raw`(?:gửi\s+xe|xe\s+máy|phí\s+xe|parking)` },
  { kind: "cleaning", name: "Vệ sinh", label: String.raw`(?:vệ\s+sinh|vs)` },
  { kind: "cleaning", name: "Rác", label: String.raw`(?:rác|rác\s+thải)` },
  { kind: "washing", name: "Máy giặt chung", label: String.raw`(?:máy\s+giặt(?:\s+chung)?|giặt\s+chung)` },
  { kind: "other", name: "Phí quản lý", label: String.raw`(?:phí\s+quản\s+lý|phi\s+quan\s+ly)` },
  { kind: "other", name: "Thẻ thang máy", label: String.raw`(?:thẻ\s+thang\s+máy|the\s+thang\s+may)` },
  { kind: "other", name: "Bảo vệ", label: String.raw`(?:bảo\s+vệ|bao\s+ve)` },
  { kind: "other", name: "Camera", label: String.raw`camera` },
]);

function normalizeComparable(value) {
  return String(value ?? "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value, maximum) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanField(value, maxLength) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’•·*☘🌷🏢⌛⭐🏆-]+/u, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim()
    .slice(0, maxLength);
}

function cleanEvidence(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim()
    .slice(0, MAX_SERVICE_EVIDENCE_LENGTH);
}

function unicodeCue(source) {
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`, "giu");
}

function escapedPattern(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsNormalizedPhrase(source, candidate) {
  if (!source || !candidate) return false;
  return ` ${source} `.includes(` ${candidate} `);
}

function valueIsGroundedInSource(sourceValue, candidateValue) {
  const source = normalizeComparable(sourceValue);
  const candidate = normalizeComparable(candidateValue);
  return containsNormalizedPhrase(source, candidate);
}

export function normalizeRoomSummarySource(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim()
    .slice(0, MAX_SOURCE_LENGTH);
}

export const normalizeRoomAddressSource = normalizeRoomSummarySource;

export function normalizeDetectedAddress(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/^[\s"'“”‘’•·*☘🌷🏢⌛⭐🏆-]+/u, "")
    .replace(/^(?:địa\s*chỉ|dia\s*chi|đc|dc|address)\s*[:：-]?\s*/iu, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim()
    .slice(0, MAX_ADDRESS_LENGTH);
}

export function addressIsGroundedInSource(sourceValue, addressValue) {
  return valueIsGroundedInSource(sourceValue, addressValue);
}

export function extractSourceAddress(sourceValue) {
  const source = normalizeRoomSummarySource(sourceValue);
  const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/^[^\p{L}\p{N}]+/u, "");
    const match = line.match(/^(?:địa\s*chỉ|dia\s*chi|đc|dc|address)\s*[:：=-]\s*(.+)$/iu);
    if (!match) continue;

    let value = match[1].trim();
    const next = lines[index + 1]?.trim() || "";
    if (
      next
      && /^(?:quận|quan|q\.?|phường|phuong|p\.?|đường|duong|ngõ|ngo|hẻm|hem)\s*[:：-]?/iu.test(next)
      && !/^(?:giá|gia|trống|trong|phòng|phong|dịch\s*vụ|dich\s*vu|nội\s*thất|noi\s*that|thang)\b/iu.test(next)
    ) {
      value = `${value} - ${next}`;
    }

    const normalized = normalizeDetectedAddress(value);
    if (normalized && addressIsGroundedInSource(source, normalized)) return normalized;
  }

  return "";
}

export function normalizeDetectedRoomField(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/^[\s"'“”‘’•·*☘🌷🏢⌛⭐🏆-]+/u, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim()
    .slice(0, MAX_ROOM_FIELD_LENGTH);
}

export function canonicalRoomType(value) {
  const normalized = normalizeComparable(value);
  if (!normalized) return "";
  if (normalized === "gac xep") return "Gác xép";
  if (normalized === "studio" || normalized === "stuido") return "Studio";
  if (normalized === "don") return "Đơn";
  const bedroomMatch = normalized.match(/^([1-9]\d*)\s*n\s*1\s*k$/u);
  return bedroomMatch ? `${Number(bedroomMatch[1])}N1K` : "";
}

function roomTypesInSource(value) {
  const source = normalizeComparable(value);
  const types = new Set();
  if (!source) return types;
  if (/\bdon\b/u.test(source)) types.add("Đơn");
  if (/\bgac xep\b/u.test(source)) types.add("Gác xép");
  if (/\b(?:studio|stuido)\b/u.test(source)) types.add("Studio");
  for (const match of source.matchAll(/\b([1-9]\d*)\s*n\s*1\s*k\b/gu)) {
    types.add(`${Number(match[1])}N1K`);
  }
  return types;
}

export function normalizeDetectedRoomType(sourceValue, value) {
  const canonical = canonicalRoomType(value);
  if (!canonical) return "";
  const sourceTypes = roomTypesInSource(sourceValue);
  if (sourceTypes.size !== 1) return "";
  return sourceTypes.has(canonical) ? canonical : "";
}

function extractSourceRoomType(sourceValue) {
  const sourceTypes = roomTypesInSource(sourceValue);
  return sourceTypes.size === 1 ? [...sourceTypes][0] : "";
}

export function canonicalElevator(value) {
  const normalized = normalizeComparable(value);
  if (!normalized) return "";
  if (/^(?:co|yes|true|co thang may|thang may|elevator)$/u.test(normalized)) return "Có";
  if (/^(?:khong|no|false|khong co|khong co thang may|khong thang may|thang bo)$/u.test(normalized)) return "Không";
  return "";
}

function splitSourceClauses(value) {
  return String(value ?? "")
    .replace(/(\d)[,.](?=\d)/g, "$1 ")
    .split(/[\n;,|•.!?]+/u)
    .map(normalizeComparable)
    .filter(Boolean);
}

function sourceClauses(value) {
  return splitSourceClauses(value);
}

function sourceStatusClauses(value) {
  return splitSourceClauses(value);
}

export function elevatorStatusInSource(value) {
  let hasElevator = false;
  let noElevator = false;

  for (const clause of sourceClauses(value)) {
    const explicitNo = /\b(?:khong co thang may|khong thang may|thang may khong(?: co)?|no elevator|without elevator|thang bo)\b/u.test(clause);
    if (explicitNo) {
      noElevator = true;
      continue;
    }
    if (/\b(?:thang may|elevator)\b/u.test(clause)) hasElevator = true;
  }

  if (hasElevator === noElevator) return "";
  return hasElevator ? "Có" : "Không";
}

export function normalizeDetectedElevator(sourceValue, value) {
  const candidate = canonicalElevator(value);
  if (!candidate) return "";
  const grounded = elevatorStatusInSource(sourceValue);
  return grounded === candidate ? candidate : "";
}

export function furnitureReferencesImage(sourceValue) {
  const source = normalizeComparable(sourceValue);
  if (!source) return false;
  return /\b(?:noi that|full do|do dac|trang bi)(?:\s+[a-z0-9]+){0,8}\s+(?:nhu anh|nhu hinh)\b/u.test(source)
    || /\b(?:nhu anh|nhu hinh)(?:\s+[a-z0-9]+){0,8}\s+(?:noi that|full do|do dac|trang bi)\b/u.test(source);
}

function normalizeFurnitureCandidate(value) {
  return normalizeDetectedRoomField(value)
    .replace(/^(?:nội\s*thất|noi\s*that|furniture|đồ\s*đạc|do\s*dac|trang\s*bị|trang\s*bi)\s*[:：-]?\s*/iu, "")
    .trim();
}

function displayFurnitureItem(value) {
  const clean = String(value || "").trim();
  const comparable = normalizeComparable(clean);
  const canonical = new Map([
    ["dieu hoa", "điều hòa"],
    ["may lanh", "điều hòa"],
    ["nong lanh", "nóng lạnh"],
    ["binh nong lanh", "nóng lạnh"],
    ["giuong", "giường"],
    ["tu", "tủ"],
    ["tu ao", "tủ quần áo"],
    ["tu quan ao", "tủ quần áo"],
    ["tu lanh", "tủ lạnh"],
    ["may giat", "máy giặt"],
    ["bep tu", "bếp từ"],
    ["tu bep", "tủ bếp"],
    ["sofa", "sofa"],
    ["rem", "rèm"],
    ["ban", "bàn"],
    ["ghe", "ghế"],
    ["ban ghe", "bàn ghế"],
    ["ban an", "bàn ăn"],
    ["ban lam viec", "bàn làm việc"],
    ["ke", "kệ"],
    ["tivi", "tivi"],
    ["tv", "tv"],
    ["may hut mui", "máy hút mùi"],
    ["lo vi song", "lò vi sóng"],
    ["dem", "đệm"],
    ["nem", "đệm"],
    ["full do", "full đồ"],
  ]).get(comparable);
  return canonical || clean.toLocaleLowerCase("vi");
}

function formatFurnitureItems(items) {
  const normalized = items
    .map((item) => String(item || "").trim().toLocaleLowerCase("vi"))
    .filter(Boolean);
  if (!normalized.length) return "";
  const joined = normalized.join(", ");
  return joined.charAt(0).toLocaleUpperCase("vi") + joined.slice(1);
}

export function normalizeDetectedFurniture(sourceValue, itemValues, asImage = false) {
  if (furnitureReferencesImage(sourceValue)) return "Như hình";
  if (asImage === true) return "";
  if (!Array.isArray(itemValues)) return "";

  const items = [];
  const seen = new Set();
  for (const raw of itemValues.slice(0, MAX_FURNITURE_ITEMS)) {
    for (const chunk of String(raw ?? "").split(/[,;+/]+/u)) {
      const candidate = normalizeFurnitureCandidate(chunk);
      if (!candidate || !valueIsGroundedInSource(sourceValue, candidate)) continue;
      const comparable = normalizeComparable(candidate);
      if (!comparable || NON_FURNITURE_ITEM_PATTERNS.some((pattern) => pattern.test(comparable))) continue;
      if (!/\p{L}/u.test(candidate) || seen.has(comparable)) continue;
      seen.add(comparable);
      items.push(displayFurnitureItem(candidate));
    }
  }
  return formatFurnitureItems(items);
}

export function extractSourceFurniture(sourceValue) {
  const source = normalizeRoomSummarySource(sourceValue);
  if (furnitureReferencesImage(source)) return "Như hình";
  if (/\b(?:nội\s*thất|noi\s*that|đồ\s*đạc|do\s*dac|trang\s*bị|trang\s*bi)\s*[:：-]?\s*full\s*đồ\b/iu.test(source)) {
    return "Full đồ";
  }

  const scoped = source
    .split(/[\n;|•]+/u)
    .filter((segment) => /(?:nội\s*thất|noi\s*that|đồ\s*đạc|do\s*dac|trang\s*bị|trang\s*bi|furniture)/iu.test(segment));

  if (!scoped.length) return "";

  const matches = [];
  for (const segment of scoped) {
    for (const definition of FURNITURE_DEFINITIONS) {
      const match = definition.pattern.exec(segment);
      if (match) matches.push({ index: match.index ?? 0, value: definition.value });
    }
  }

  matches.sort((a, b) => a.index - b.index || b.value.length - a.value.length);
  const seen = new Set();
  const values = [];
  for (const match of matches) {
    const key = normalizeComparable(match.value);
    if (seen.has(key)) continue;
    if (key === "tu" && [...seen].some((value) => value.startsWith("tu "))) continue;
    if (key === "ban" && [...seen].some((value) => value.startsWith("ban "))) continue;
    if (key === "ghe" && seen.has("ban ghe")) continue;
    seen.add(key);
    values.push(displayFurnitureItem(match.value));
  }
  return formatFurnitureItems(values);
}

function phrasePositions(source, candidate) {
  if (!source || !candidate) return [];
  const haystack = ` ${source} `;
  const needle = ` ${candidate} `;
  const positions = [];
  let offset = 0;
  while (offset < haystack.length) {
    const found = haystack.indexOf(needle, offset);
    if (found < 0) break;
    positions.push(found + 1);
    offset = found + needle.length - 1;
  }
  return positions;
}

function removeNormalizedPhrase(source, candidate) {
  if (!source || !candidate) return source;
  return (` ${source} `).split(` ${candidate} `).join(" ").replace(/\s+/g, " ").trim();
}

function priceLikePattern(flags = "u") {
  return new RegExp("\\b\\d+(?:\\s+\\d+)?\\s*(?:tr|trieu|m|k)\\d*\\b", flags);
}

function containsOtherRoomLikeToken(value) {
  const source = String(value || "");
  return /\b(?:p\d+[a-z]?|[a-z]{1,3}\d{1,4})\b/u.test(source)
    || /\b(?:phong|room)\s+\d{1,4}\b/u.test(source)
    || /\b\d{2,4}\b/u.test(source);
}

function fieldIsNearestToRoom(clause, targetRoom, field, roomValues) {
  const fieldPositions = phrasePositions(clause, field);
  const targetPositions = phrasePositions(clause, targetRoom);
  if (!fieldPositions.length || !targetPositions.length) return false;

  const roomsInClause = roomValues.filter((room) => containsNormalizedPhrase(clause, room));
  if (roomsInClause.length <= 1) return true;

  return fieldPositions.some((fieldPosition) => {
    const distances = roomsInClause.map((room) => {
      const positions = phrasePositions(clause, room);
      const distance = Math.min(...positions.map((roomPosition) => Math.abs(roomPosition - fieldPosition)));
      return { room, distance };
    });
    const minimum = Math.min(...distances.map(({ distance }) => distance));
    const nearestRooms = distances.filter(({ distance }) => distance === minimum);
    return nearestRooms.length === 1 && nearestRooms[0].room === targetRoom;
  });
}

function groupedPriceClauseIsExplicit(clause, targetRoom, field, roomValues) {
  if (!/\b(?:gia|price|rent)\b/u.test(clause)) return false;
  const roomsInClause = roomValues.filter((room) => containsNormalizedPhrase(clause, room));
  if (roomsInClause.length < 2 || !roomsInClause.includes(targetRoom)) return false;
  const fieldPositions = phrasePositions(clause, field);
  if (fieldPositions.length !== 1) return false;
  const roomPositions = roomsInClause.flatMap((room) => phrasePositions(clause, room));
  if (!roomPositions.length) return false;
  const fieldPosition = fieldPositions[0];
  const outside = fieldPosition < Math.min(...roomPositions) || fieldPosition > Math.max(...roomPositions);
  if (!outside) return false;
  return !priceLikePattern().test(removeNormalizedPhrase(clause, field));
}

function groupedAvailabilityClauseIsExplicit(clause, targetRoom, field, roomValues) {
  const hasScope = /\b(?:trong|available|availability|con|sap)\b/u.test(clause)
    || /\b(?:vao luon|cuoi thang|dau thang|giua thang)\b/u.test(field);
  if (!hasScope) return false;
  const roomsInClause = roomValues.filter((room) => containsNormalizedPhrase(clause, room));
  if (roomsInClause.length < 2 || !roomsInClause.includes(targetRoom)) return false;
  const fieldPositions = phrasePositions(clause, field);
  if (fieldPositions.length !== 1) return false;
  const roomPositions = roomsInClause.flatMap((room) => phrasePositions(clause, room));
  if (!roomPositions.length) return false;
  const fieldPosition = fieldPositions[0];
  const outside = fieldPosition < Math.min(...roomPositions) || fieldPosition > Math.max(...roomPositions);
  if (!outside) return false;

  let remainder = removeNormalizedPhrase(clause, field);
  for (const room of roomsInClause) remainder = removeNormalizedPhrase(remainder, room);
  remainder = remainder
    .replace(/\b(?:phong|room|trong|available|availability|ngay|tu|cac|nhung|con|dang|sap)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !remainder;
}

function pairedPriceClauseIsExplicit(clause, targetRoom, field, roomValues) {
  const roomOccurrences = roomValues
    .flatMap((room) => phrasePositions(clause, room).map((position) => ({ room, position })))
    .sort((a, b) => a.position - b.position);
  if (roomOccurrences.length < 2) return false;

  const priceOccurrences = [...clause.matchAll(priceLikePattern("g"))]
    .map((match) => ({ value: normalizeComparable(match[0]), position: match.index ?? -1 }))
    .filter(({ position }) => position >= 0);
  if (priceOccurrences.length < 2) return false;

  const candidatePositions = phrasePositions(clause, field);
  if (!candidatePositions.length) return false;

  const roomFirst = roomOccurrences[0].position < priceOccurrences[0].position;
  return candidatePositions.some((candidatePosition) => roomOccurrences.some((occurrence, index) => {
    if (occurrence.room !== targetRoom) return false;
    if (roomFirst) {
      const nextRoom = roomOccurrences[index + 1]?.position ?? Number.POSITIVE_INFINITY;
      return candidatePosition > occurrence.position && candidatePosition < nextRoom;
    }
    const previousRoom = roomOccurrences[index - 1]?.position ?? Number.NEGATIVE_INFINITY;
    return candidatePosition < occurrence.position && candidatePosition > previousRoom;
  }));
}

function sharedFieldClauseIsExplicit(clause, field, fieldKind) {
  const kindMatches = fieldKind === "price"
    ? /\b(?:gia|price|rent)\b/u.test(clause)
    : fieldKind === "availability"
      ? /\b(?:trong|available|availability|vao luon)\b/u.test(clause)
      : false;
  if (!kindMatches) return false;
  return !containsOtherRoomLikeToken(removeNormalizedPhrase(clause, field));
}

export function roomFieldIsGroundedInSource(sourceValue, fieldValue) {
  return valueIsGroundedInSource(sourceValue, fieldValue);
}

export function roomIdentifierIsGroundedInSource(sourceValue, roomValue) {
  const room = normalizeComparable(roomValue);
  if (!room || !roomFieldIsGroundedInSource(sourceValue, roomValue)) return false;

  if (/^(?:p?\d{1,4}|[a-z]{1,3}\d{1,4}[a-z]?)$/u.test(room)) {
    const identity = roomIdentity(roomValue);
    return Boolean(identity) && extractSourceRoomMentions(sourceValue)
      .some((candidate) => candidate.identity === identity);
  }

  return true;
}

export function roomFieldIsAssociatedInSource(sourceValue, roomValue, fieldValue, roomValues = [], fieldKind = "") {
  const field = normalizeComparable(fieldValue);
  if (!field || !roomFieldIsGroundedInSource(sourceValue, fieldValue)) return false;

  const room = normalizeComparable(roomValue);
  const rooms = [...new Set(roomValues.map(normalizeComparable).filter(Boolean))];
  const clauses = sourceClauses(sourceValue);

  if (room) {
    for (const clause of clauses) {
      if (!containsNormalizedPhrase(clause, field) || !containsNormalizedPhrase(clause, room)) continue;
      if (fieldKind === "price" && groupedPriceClauseIsExplicit(clause, room, field, rooms)) return true;
      if (fieldKind === "price" && pairedPriceClauseIsExplicit(clause, room, field, rooms)) return true;
      if (fieldKind === "availability" && groupedAvailabilityClauseIsExplicit(clause, room, field, rooms)) return true;
      if (fieldIsNearestToRoom(clause, room, field, rooms)) return true;
    }
  }

  return clauses.some((clause) => (
    containsNormalizedPhrase(clause, field)
    && sharedFieldClauseIsExplicit(clause, field, fieldKind)
  ));
}

export function roomIsExplicitlyUnavailableInSource(sourceValue, roomValue) {
  const room = normalizeComparable(roomValue);
  if (!room) return false;
  return sourceStatusClauses(sourceValue).some((clause) => (
    containsNormalizedPhrase(clause, room)
    && EXPLICIT_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(clause))
  ));
}

function normalizeAiRoomRows(sourceValue, roomValues) {
  if (!Array.isArray(roomValues)) return [];
  const candidates = roomValues.slice(0, MAX_ROOMS).map((raw) => ({
    roomCandidate: normalizeDetectedRoomField(raw?.room),
    priceCandidate: normalizeDetectedRoomField(raw?.price),
    availabilityCandidate: normalizeDetectedRoomField(raw?.availability),
  }));
  const groundedRoomValues = candidates.map(({ roomCandidate }) => (
    roomCandidate && roomIdentifierIsGroundedInSource(sourceValue, roomCandidate) ? roomCandidate : ""
  ));
  const allRooms = groundedRoomValues.filter(Boolean);
  const validated = [];

  candidates.forEach((candidate, index) => {
    const room = groundedRoomValues[index];
    if (candidate.roomCandidate && !room) return;
    if (room && roomIsExplicitlyUnavailableInSource(sourceValue, room)) return;

    const price = candidate.priceCandidate
      && roomFieldIsAssociatedInSource(sourceValue, room, candidate.priceCandidate, allRooms, "price")
      ? candidate.priceCandidate
      : "";
    const availability = candidate.availabilityCandidate
      && roomFieldIsAssociatedInSource(sourceValue, room, candidate.availabilityCandidate, allRooms, "availability")
      ? candidate.availabilityCandidate
      : "";

    if (!room && !price && !availability) return;
    validated.push({ room, price, availability });
  });

  return mergeRoomFacts(validated);
}

function mergeSingleFact(current, incoming) {
  if (!current) return incoming || "";
  if (!incoming) return current;
  return normalizeComparable(current) === normalizeComparable(incoming) ? current : "";
}

function mergeRoomFacts(rows) {
  const merged = [];
  const byRoom = new Map();
  const emptyRows = new Set();

  for (const row of rows) {
    const roomKey = normalizeComparable(row.room);
    if (!roomKey) {
      const key = [row.price, row.availability].map(normalizeComparable).join("|");
      if (emptyRows.has(key)) continue;
      emptyRows.add(key);
      merged.push({ ...row });
      continue;
    }
    const existing = byRoom.get(roomKey);
    if (!existing) {
      const copy = { ...row };
      byRoom.set(roomKey, copy);
      merged.push(copy);
      continue;
    }
    existing.price = mergeSingleFact(existing.price, row.price);
    existing.availability = mergeSingleFact(existing.availability, row.availability);
  }
  return merged;
}

function roomIdentity(value) {
  const normalized = normalizeComparable(value)
    .replace(/^(?:phong|room)\s+/u, "")
    .replace(/\s+/g, "");
  if (!normalized) return "";
  const numeric = normalized.match(/^p?(\d{1,4})$/u);
  if (numeric) return `number:${numeric[1]}`;
  return `code:${normalized}`;
}

function sourcePricePattern() {
  return /(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|m|k)\s*\d*(?:\s*\/\s*(?:tháng|thang))?(?![\p{L}\p{N}_])/giu;
}

function sourceAvailabilityDatePattern() {
  return /(?<![\p{L}\p{N}_])(?:\d{1,2}\s*\/\s*(?:\d{1,2}(?:\s*\/\s*\d{2,4})?|\d{4})|\d{4}\s*-\s*\d{1,2}\s*-\s*\d{1,2})(?![\p{L}\p{N}_])/gu;
}

function sourceAvailabilityPhrasePattern() {
  return /\b(?:vào\s+luôn|vao\s+luon|trống\s+ngay|trong\s+ngay|cuối\s+tháng|cuoi\s+thang|đầu\s+tháng|dau\s+thang|giữa\s+tháng|giua\s+thang)\b/giu;
}

function sourceAreaPattern() {
  return /(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)?\s*m\s*(?:2|²)(?![\p{L}\p{N}_])/giu;
}

function sourceFloorPattern() {
  return /(?<![\p{L}\p{N}_])(?:tầng|tang|floor)\s*[:#-]?\s*\d{1,2}(?![\p{L}\p{N}_])/giu;
}

function sourcePercentPattern() {
  return /\b\d+(?:[.,]\d+)?\s*%/gu;
}

function sourceNonRoomLabeledNumberPattern() {
  return /\b(?:mã|ma|code|id|hh|hoa\s*hồng|hoa\s*hong|cọc|coc|deposit)\s*[:#=-]?\s*(?:p\s*[-:]?\s*\d{1,4}[a-z]?|[a-z]{1,3}\d{1,4}[a-z]?|\d{2,4})\b/giu;
}

function collectRanges(value, pattern) {
  return [...String(value ?? "").matchAll(pattern)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function overlapsAny(range, ranges) {
  return ranges.some((candidate) => rangesOverlap(range, candidate));
}

function sourceSegments(value) {
  return String(value ?? "").split(/[\n;|•]+/u).map((segment) => segment.trim()).filter(Boolean);
}

function lineHasRoomScope(line) {
  const normalized = normalizeComparable(line);
  if (/(?:^|\s)(?:phong|room|trong|available|availability|con|sap|gia|price|rent)(?:\s|$)/u.test(normalized)) {
    return true;
  }
  return /\bp\s*[-:]?\s*\d{1,4}[a-z]?\b/iu.test(line);
}

function separatorOnly(value) {
  return !String(value ?? "").replace(/[\s,.:;|()[\]{}\-–—/]+/gu, "").trim();
}

function candidateIsAdjacentToPrice(line, candidateRange, priceRanges) {
  return priceRanges.some((priceRange) => {
    if (priceRange.end <= candidateRange.start) {
      return separatorOnly(line.slice(priceRange.end, candidateRange.start));
    }
    if (candidateRange.end <= priceRange.start) {
      return separatorOnly(line.slice(candidateRange.end, priceRange.start));
    }
    return false;
  });
}

function lineHasStrongBareRoomScope(line, normalizedLine) {
  if (/(?:^|\s)(?:phong|room|trong|available|availability|con|sap)(?:\s|$)/u.test(normalizedLine)) return true;
  return /\bp\s*[-:]?\s*\d{1,4}[a-z]?\b/iu.test(line);
}

function addRoomCandidate(candidates, rawValue, index, length, priority, excludedRanges) {
  const range = { start: index, end: index + length };
  if (overlapsAny(range, excludedRanges)) return;
  const room = normalizeDetectedRoomField(rawValue)
    .replace(/^(?:phòng|phong|room)\s*[:#-]?\s*/iu, "")
    .trim();
  const identity = roomIdentity(room);
  if (!room || !identity) return;
  candidates.push({ room, identity, index, priority, range });
}

export function extractSourceRoomMentions(sourceValue) {
  const byIdentity = new Map();
  let sourceOffset = 0;

  for (const line of sourceSegments(sourceValue)) {
    if (!lineHasRoomScope(line)) {
      sourceOffset += line.length + 1;
      continue;
    }

    const normalizedLine = normalizeComparable(line);
    const hasAddressCue = /(?:^|\s)(?:dia chi|address|dc)(?:\s|$)/u.test(normalizedLine);
    const priceRanges = collectRanges(line, sourcePricePattern());
    const excludedRanges = [
      ...priceRanges,
      ...collectRanges(line, sourceAvailabilityDatePattern()),
      ...collectRanges(line, sourceAreaPattern()),
      ...collectRanges(line, sourceFloorPattern()),
      ...collectRanges(line, sourcePercentPattern()),
      ...collectRanges(line, sourceNonRoomLabeledNumberPattern()),
    ];
    const candidates = [];

    for (const match of line.matchAll(/(?:phòng|phong|room)\s*[:#-]?\s*((?:p\s*[-:]?\s*)?[a-z]?\d{1,4}[a-z]?)/giu)) {
      const raw = match[1];
      const relative = match[0].lastIndexOf(raw);
      addRoomCandidate(candidates, raw, (match.index ?? 0) + Math.max(relative, 0), raw.length, 4, excludedRanges);
    }
    for (const match of line.matchAll(/\bp\s*[-:]?\s*\d{1,4}[a-z]?\b/giu)) {
      addRoomCandidate(candidates, match[0], match.index ?? 0, match[0].length, 3, excludedRanges);
    }
    for (const match of line.matchAll(/\b[a-z]{1,3}\d{1,4}[a-z]?\b/giu)) {
      addRoomCandidate(candidates, match[0], match.index ?? 0, match[0].length, 2, excludedRanges);
    }

    if (!hasAddressCue) {
      const strongBareScope = lineHasStrongBareRoomScope(line, normalizedLine);
      for (const match of line.matchAll(/\b\d{2,4}\b/gu)) {
        const range = { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length };
        if (!strongBareScope && !candidateIsAdjacentToPrice(line, range, priceRanges)) continue;
        addRoomCandidate(candidates, match[0], range.start, match[0].length, 1, excludedRanges);
      }
    }

    candidates.sort((a, b) => a.index - b.index || b.priority - a.priority);
    for (const candidate of candidates) {
      const existing = byIdentity.get(candidate.identity);
      const absoluteIndex = sourceOffset + candidate.index;
      if (!existing) {
        byIdentity.set(candidate.identity, { ...candidate, index: absoluteIndex });
      } else if (candidate.priority > existing.priority) {
        byIdentity.set(candidate.identity, { ...candidate, index: existing.index });
      }
    }
    sourceOffset += line.length + 1;
  }

  return [...byIdentity.values()]
    .sort((a, b) => a.index - b.index)
    .slice(0, MAX_ROOMS)
    .map(({ room, identity }) => ({ room, identity }));
}

function uniqueSourceValues(values) {
  const seen = new Set();
  const output = [];
  for (const raw of values) {
    const value = String(raw ?? "").trim();
    const key = normalizeComparable(value);
    if (!value || !key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function sourcePriceValues(sourceValue) {
  const source = String(sourceValue ?? "");
  const areaRanges = collectRanges(source, sourceAreaPattern());
  return uniqueSourceValues(
    [...source.matchAll(sourcePricePattern())]
      .filter((match) => !overlapsAny({
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      }, areaRanges))
      .map((match) => match[0]),
  );
}

function sourceAvailabilityValues(sourceValue) {
  const values = [];
  for (const line of sourceSegments(sourceValue)) {
    const normalized = normalizeComparable(line);
    const hasCue = /(?:^|\s)(?:trong|available|availability|con|sap|vao luon)(?:\s|$)/u.test(normalized);
    if (!hasCue) continue;
    values.push(...[...line.matchAll(sourceAvailabilityDatePattern())].map((match) => match[0]));
    values.push(...[...line.matchAll(sourceAvailabilityPhrasePattern())].map((match) => match[0]));
  }
  return uniqueSourceValues(values);
}

function mergeFact(current, incoming) {
  const left = String(current ?? "").trim();
  const right = String(incoming ?? "").trim();
  if (!left) return right;
  if (!right) return left;
  return left;
}

function mergeRowsBySourceIdentity(sourceValue, sourceMentions, aiRows) {
  const rows = [];
  const byIdentity = new Map();

  for (const mention of sourceMentions) {
    if (roomIsExplicitlyUnavailableInSource(sourceValue, mention.room)) continue;
    const row = { room: mention.room, price: "", availability: "" };
    byIdentity.set(mention.identity, row);
    rows.push(row);
  }

  for (const raw of aiRows) {
    const room = String(raw?.room ?? "").trim();
    const identity = roomIdentity(room);
    if (!identity) {
      if (raw?.price || raw?.availability) rows.push({ ...raw });
      continue;
    }
    const existing = byIdentity.get(identity);
    if (existing) {
      existing.price = mergeFact(existing.price, raw?.price);
      existing.availability = mergeFact(existing.availability, raw?.availability);
      continue;
    }
    if (!roomIdentifierIsGroundedInSource(sourceValue, room)) continue;
    if (roomIsExplicitlyUnavailableInSource(sourceValue, room)) continue;
    const row = {
      room,
      price: String(raw?.price ?? "").trim(),
      availability: String(raw?.availability ?? "").trim(),
    };
    byIdentity.set(identity, row);
    rows.push(row);
  }

  return rows.slice(0, MAX_ROOMS);
}

function uniqueAssociatedValue(sourceValue, room, roomValues, values, fieldKind) {
  const matches = uniqueSourceValues(values.filter((value) => (
    roomFieldIsAssociatedInSource(sourceValue, room, value, roomValues, fieldKind)
  )));
  return matches.length === 1 ? matches[0] : "";
}

export function normalizeDetectedRooms(sourceValue, roomValues) {
  const source = normalizeRoomSummarySource(sourceValue);
  const aiRows = normalizeAiRoomRows(source, Array.isArray(roomValues) ? roomValues : []);
  const sourceMentions = extractSourceRoomMentions(source);
  const rows = mergeRowsBySourceIdentity(source, sourceMentions, aiRows);
  const roomValuesInSource = rows.map((row) => row.room).filter(Boolean);

  const prices = uniqueSourceValues([...sourcePriceValues(source), ...aiRows.map((row) => row.price).filter(Boolean)]);
  const availabilities = uniqueSourceValues([
    ...sourceAvailabilityValues(source),
    ...aiRows.map((row) => row.availability).filter(Boolean),
  ]);

  if (!roomValuesInSource.length) {
    if (rows.length) return rows;
    const scopedPrice = sourceSegments(source).some((line) => /\b(?:giá|gia|price|rent)\b/iu.test(line))
      && prices.length === 1 ? prices[0] : "";
    const scopedAvailability = availabilities.length === 1 ? availabilities[0] : "";
    return scopedPrice || scopedAvailability
      ? [{ room: "", price: scopedPrice, availability: scopedAvailability }]
      : [];
  }

  for (const row of rows) {
    if (!row.room) continue;
    const sourcePrice = uniqueAssociatedValue(source, row.room, roomValuesInSource, prices, "price");
    if (sourcePrice) row.price = sourcePrice;
    const sourceAvailability = uniqueAssociatedValue(
      source,
      row.room,
      roomValuesInSource,
      availabilities,
      "availability",
    );
    if (sourceAvailability) row.availability = sourceAvailability;
  }

  return rows;
}

function normalizeRateIdentity(value) {
  return String(value ?? "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "")
    .replace(/\/(?:1)?(?:ng|nguoi)$/u, "/ng")
    .replace(/\/(?:1)?(?:m3|m³|khoi)$/u, "/khoi")
    .replace(/\/(?:1)?phong$/u, "/phong")
    .replace(/\/(?:1)?xe$/u, "/xe")
    .replace(/\/(?:1)?thang$/u, "/thang")
    .replace(/\/(?:1)?(?:so|kwh)$/u, "/so")
    .trim();
}

function formatServiceRate(value, serviceKind) {
  let clean = String(value || "")
    .trim()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\bK\b/g, "k");

  if (serviceKind === "electricity") {
    clean = clean.replace(/\/(?:1\s*)?(?:số|so)$/iu, "/số").replace(/\/kwh$/iu, "/số");
  }
  if (serviceKind === "water") {
    clean = clean
      .replace(/\/(?:ng|người|nguoi)$/iu, "/người")
      .replace(/\/(?:m3|m³|khối|khoi)$/iu, "/khối");
  }
  return clean;
}

export function serviceRateIsGroundedInSource(sourceValue, serviceKind, rateValue) {
  const rate = normalizeComparable(rateValue);
  if (!rate || !["electricity", "water"].includes(serviceKind)) return false;
  const targetToken = serviceKind === "electricity" ? "dien" : "nuoc";
  const serviceTokens = ["dien", "nuoc"];

  return sourceClauses(sourceValue).some((clause) => {
    if (!containsNormalizedPhrase(clause, rate) || !containsNormalizedPhrase(clause, targetToken)) return false;
    const tokensInClause = serviceTokens.filter((token) => containsNormalizedPhrase(clause, token));
    if (tokensInClause.length <= 1) return true;

    const ratePositions = phrasePositions(clause, rate);
    if (!ratePositions.length) return false;

    return ratePositions.some((ratePosition) => {
      const distances = tokensInClause.map((token) => {
        const tokenPositions = phrasePositions(clause, token);
        const distance = Math.min(...tokenPositions.map((position) => Math.abs(position - ratePosition)));
        return { token, distance };
      });
      const minimum = Math.min(...distances.map(({ distance }) => distance));
      const nearest = distances.filter(({ distance }) => distance === minimum);
      return nearest.length === 1 && nearest[0].token === targetToken;
    });
  });
}

export function normalizeDetectedServiceRate(sourceValue, serviceKind, value) {
  const candidate = normalizeDetectedRoomField(value)
    .replace(/^(?:điện|dien|electricity|nước|nuoc|water)\s*[:：-]?\s*/iu, "")
    .trim();
  if (!candidate || candidate.length > 80 || !/\d/u.test(candidate)) return "";
  if (!serviceRateIsGroundedInSource(sourceValue, serviceKind, candidate)) return "";
  return formatServiceRate(candidate, serviceKind);
}

export function normalizeDetectedServices(sourceValue, electricityValue, waterValue) {
  return {
    electricity: normalizeDetectedServiceRate(sourceValue, "electricity", electricityValue),
    water: normalizeDetectedServiceRate(sourceValue, "water", waterValue),
  };
}

function ratePattern(flags = "giu") {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${RATE_SOURCE}(?![\\p{L}\\p{N}_])`, flags);
}

function rateMatches(value) {
  return [...String(value ?? "").matchAll(ratePattern())].map((match) => ({
    value: match[0],
    signature: normalizeRateIdentity(match[0]),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function extractSourceUtilityRate(sourceValue, serviceKind) {
  const values = [];
  const sharedPattern = new RegExp(`(?<![\\p{L}\\p{N}_])${SHARED_UTILITY_LABEL_SOURCE}(?![\\p{L}\\p{N}_])`, "iu");

  for (const segment of sourceSegments(sourceValue)) {
    if (sharedPattern.test(segment) && rateMatches(segment).length === 1) continue;
    for (const rate of rateMatches(segment)) {
      if (serviceRateIsGroundedInSource(segment, serviceKind, rate.value)) {
        values.push(formatServiceRate(rate.value, serviceKind));
      }
    }
  }

  const unique = uniqueSourceValues(values);
  return unique.length === 1 ? unique[0] : "";
}

function extractSourceUtilityServices(sourceValue) {
  return {
    electricity: extractSourceUtilityRate(sourceValue, "electricity"),
    water: extractSourceUtilityRate(sourceValue, "water"),
  };
}

function formatSourceServiceValue(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\bK\b/g, "k")
    .replace(/\/(?:1\s*)?(?:ng|người|nguoi)$/iu, "/người")
    .replace(/\/(?:1\s*)?(?:m3|m³|khối|khoi)$/iu, "/khối")
    .replace(/\/(?:1\s*)?(?:phòng|phong)$/iu, "/phòng")
    .replace(/\/(?:1\s*)?xe$/iu, "/xe")
    .replace(/\/(?:1\s*)?(?:tháng|thang)$/iu, "/tháng")
    .replace(/\/(?:1\s*)?(?:số|so|kwh)$/iu, "/số");
}

function hasRate(value) {
  return rateMatches(value).length > 0;
}

function looksLikePackageContinuation(value) {
  const source = String(value ?? "").trim();
  if (!source || hasRate(source)) return false;
  const normalized = normalizeComparable(source);
  if (/^(?:gom|bao gom|incl|including)\b/u.test(normalized)) return true;
  if (/^[([{]/u.test(source)) return true;
  return PACKAGE_MEMBER_PATTERNS.filter(({ pattern }) => pattern.test(source)).length >= 2;
}

function sourceServiceSegments(sourceValue) {
  const pieces = String(sourceValue ?? "").split(/[\n;|•]+/u).map((piece) => piece.trim()).filter(Boolean);
  const segments = [];

  for (let index = 0; index < pieces.length; index += 1) {
    let segment = pieces[index];
    const commonRate = new RegExp(
      `(?<![\\p{L}\\p{N}_])${COMMON_LABEL_SOURCE}(?![\\p{L}\\p{N}_])\\s*[:：=-]?\\s*${RATE_SOURCE}`,
      "iu",
    ).test(segment);
    if (commonRate && index + 1 < pieces.length && looksLikePackageContinuation(pieces[index + 1])) {
      segment = `${segment} ${pieces[index + 1]}`;
      index += 1;
    }
    segments.push(segment);
  }

  return segments;
}

function packageIncludes(segment, rateEnd = 0) {
  const tail = String(segment ?? "").slice(rateEnd);
  const includes = [];
  for (const definition of PACKAGE_MEMBER_PATTERNS) {
    if (definition.pattern.test(tail)) includes.push(definition.value);
  }
  return [...new Set(includes)];
}

function utilitySpecificRate(value) {
  return /\/(?:so|khoi)$/u.test(normalizeRateIdentity(value));
}

function tailStartsWithUtilityCue(value) {
  return /^(?:dien|nuoc)\b/u.test(normalizeComparable(value));
}

function genericCommonScopeIsClear(label, rate, tail, includes) {
  const normalizedLabel = normalizeComparable(label);
  if (/\bchung\b/u.test(normalizedLabel) || normalizedLabel === "phi chung") return true;
  if (utilitySpecificRate(rate) || tailStartsWithUtilityCue(tail)) return false;

  const normalizedTail = normalizeComparable(tail);
  const hasBundleCue = /^(?:gom|bao gom|incl|including)\b/u.test(normalizedTail)
    || /^[([{]/u.test(String(tail ?? "").trim());
  if (hasBundleCue) return true;
  if (includes.length >= 2) return true;
  if (includes.length === 1) return false;
  return true;
}

function commonCandidates(segment) {
  const candidates = [];
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${COMMON_LABEL_SOURCE})(?![\\p{L}\\p{N}_])\\s*[:：=-]?\\s*(${RATE_SOURCE})`,
    "giu",
  );

  for (const match of segment.matchAll(pattern)) {
    const full = match[0];
    const rate = match[2];
    const rateOffset = full.lastIndexOf(rate);
    const rateEnd = (match.index ?? 0) + Math.max(rateOffset, 0) + rate.length;
    const tail = segment.slice(rateEnd);
    const includes = packageIncludes(segment, rateEnd);
    if (!genericCommonScopeIsClear(match[1], rate, tail, includes)) continue;
    candidates.push({
      kind: "common",
      name: "Dịch vụ chung",
      value: formatSourceServiceValue(rate),
      includes,
    });
  }
  return candidates;
}

function sharedUtilityCandidates(segment) {
  const candidates = [];
  const forward = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${SHARED_UTILITY_LABEL_SOURCE})(?![\\p{L}\\p{N}_])\\s*[:：=-]?\\s*(${RATE_SOURCE})`,
    "giu",
  );
  for (const match of segment.matchAll(forward)) {
    candidates.push({ kind: "other", name: "Điện + nước", value: formatSourceServiceValue(match[2]), includes: [] });
  }

  const reverse = new RegExp(
    `(${RATE_SOURCE})\\s*[:：=-]?\\s*(?<![\\p{L}\\p{N}_])(${SHARED_UTILITY_LABEL_SOURCE})(?![\\p{L}\\p{N}_])`,
    "giu",
  );
  for (const match of segment.matchAll(reverse)) {
    candidates.push({ kind: "other", name: "Điện + nước", value: formatSourceServiceValue(match[1]), includes: [] });
  }
  return candidates;
}

function explicitServiceCandidates(segment) {
  const candidates = [];
  for (const definition of EXPLICIT_SERVICE_DEFINITIONS) {
    const forward = new RegExp(
      `(?<![\\p{L}\\p{N}_])(${definition.label})(?![\\p{L}\\p{N}_])\\s*[:：=-]?\\s*(${RATE_SOURCE})`,
      "giu",
    );
    for (const match of segment.matchAll(forward)) {
      candidates.push({
        kind: definition.kind,
        name: definition.name,
        value: formatSourceServiceValue(match[2]),
        includes: [],
      });
    }

    const reverse = new RegExp(
      `(${RATE_SOURCE})\\s*[:：=-]?\\s*(?<![\\p{L}\\p{N}_])(${definition.label})(?![\\p{L}\\p{N}_])`,
      "giu",
    );
    for (const match of segment.matchAll(reverse)) {
      candidates.push({
        kind: definition.kind,
        name: definition.name,
        value: formatSourceServiceValue(match[1]),
        includes: [],
      });
    }
  }
  return candidates;
}

function memberBundleCandidates(segment) {
  if (sharedUtilityCandidates(segment).length) return [];
  const rates = rateMatches(segment);
  if (rates.length !== 1) return [];
  const includes = packageIncludes(segment, 0);
  if (includes.length < 2) return [];

  const normalized = normalizeComparable(segment);
  const hasBundleCue = /(?:^|\s)(?:gom|bao gom)(?:\s|$)/u.test(normalized)
    || /\s(?:va|voi)\s/u.test(normalized)
    || /[+&]/u.test(segment);
  if (!hasBundleCue && explicitServiceCandidates(segment).length) return [];

  return [{
    kind: "common",
    name: "Dịch vụ chung",
    value: formatSourceServiceValue(rates[0].value),
    includes,
  }];
}

function mergeIncludes(left, right) {
  const seen = new Set();
  const output = [];
  for (const value of [...(left || []), ...(right || [])]) {
    const clean = String(value ?? "").trim();
    const key = normalizeComparable(clean);
    if (!clean || !key || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

function semanticIdentity(item) {
  return `${String(item?.kind ?? "other").trim() || "other"}|${normalizeComparable(item?.name)}`;
}

function fullIdentity(item) {
  return `${semanticIdentity(item)}|${normalizeRateIdentity(item?.value)}`;
}

function packageIncludesItemName(pkg, item) {
  const itemName = normalizeComparable(item?.name);
  return Boolean(itemName) && (pkg?.includes || []).some((value) => normalizeComparable(value) === itemName);
}

function packageContainsItemAtSameRate(pkg, item) {
  return pkg.kind === "common"
    && item.kind !== "common"
    && packageIncludesItemName(pkg, item)
    && normalizeRateIdentity(pkg.value) === normalizeRateIdentity(item.value);
}

function resolvePackageMembership(items) {
  const independent = items.filter((item) => item.kind !== "common");
  const withCleanIncludes = items.map((item) => {
    if (item.kind !== "common") return item;
    return {
      ...item,
      includes: (item.includes || []).filter((include) => {
        const includeName = normalizeComparable(include);
        return !independent.some((other) => (
          normalizeComparable(other.name) === includeName
          && normalizeRateIdentity(other.value) !== normalizeRateIdentity(item.value)
        ));
      }),
    };
  });

  const packages = withCleanIncludes.filter((item) => item.kind === "common");
  return withCleanIncludes.filter((item) => (
    item.kind === "common" || !packages.some((pkg) => packageContainsItemAtSameRate(pkg, item))
  ));
}

function dedupeItems(items) {
  const byIdentity = new Map();
  for (const item of items) {
    const identity = fullIdentity(item);
    const existing = byIdentity.get(identity);
    if (existing) {
      existing.includes = mergeIncludes(existing.includes, item.includes);
      continue;
    }
    byIdentity.set(identity, {
      kind: item.kind,
      name: item.name,
      value: item.value,
      includes: mergeIncludes([], item.includes),
    });
  }
  return [...byIdentity.values()];
}

export function extractSourceDynamicServiceItems(sourceValue) {
  const candidates = [];
  for (const segment of sourceServiceSegments(sourceValue)) {
    candidates.push(...commonCandidates(segment));
    candidates.push(...sharedUtilityCandidates(segment));
    candidates.push(...explicitServiceCandidates(segment));
    candidates.push(...memberBundleCandidates(segment));
  }
  return resolvePackageMembership(dedupeItems(candidates)).slice(0, MAX_SERVICE_ITEMS);
}

function targetCuePatterns(kind, name) {
  const comparable = normalizeComparable(name);
  if (kind === "common") {
    return [
      unicodeCue(String.raw`(?:dịch\s+vụ\s+chung|dv\s+chung|phí\s+chung|phí\s+(?:dịch\s+vụ|dv)\s+chung)`),
      unicodeCue(String.raw`(?:dịch\s+vụ|dv|phí\s+dịch\s+vụ|phí\s+dv)`),
    ];
  }
  if (kind === "internet") return [unicodeCue(String.raw`(?:mạng|internet|wifi)`)];
  if (kind === "parking") return [unicodeCue(String.raw`(?:gửi\s+xe|xe\s+máy|parking|phí\s+xe)`)];
  if (kind === "washing") return [unicodeCue(String.raw`(?:máy\s+giặt(?:\s+chung)?|giặt\s+chung)`)];
  if (kind === "cleaning") {
    return comparable === "rac"
      ? [unicodeCue(String.raw`rác`)]
      : [unicodeCue(String.raw`(?:vệ\s+sinh|vs)`)];
  }
  if (comparable === "dien nuoc" || comparable === "nuoc dien") {
    return [unicodeCue(String.raw`(?:điện\s*(?:\+|&|và)?\s*nước|nước\s*(?:\+|&|và)?\s*điện)`)];
  }
  const literal = cleanField(name, MAX_SERVICE_NAME_LENGTH);
  return literal ? [unicodeCue(escapedPattern(literal))] : [];
}

const KNOWN_SERVICE_CUE_PATTERNS = Object.freeze([
  unicodeCue(String.raw`(?:dịch\s+vụ\s+chung|dv\s+chung|phí\s+chung|phí\s+(?:dịch\s+vụ|dv)\s+chung)`),
  unicodeCue(String.raw`(?:mạng|internet|wifi)`),
  unicodeCue(String.raw`(?:gửi\s+xe|xe\s+máy|parking|phí\s+xe)`),
  unicodeCue(String.raw`(?:vệ\s+sinh|vs|rác)`),
  unicodeCue(String.raw`(?:máy\s+giặt(?:\s+chung)?|giặt\s+chung)`),
  unicodeCue(String.raw`(?:điện|electricity)`),
  unicodeCue(String.raw`(?:nước|water)`),
]);

function patternPositions(text, patterns) {
  const positions = [];
  for (const sourcePattern of patterns) {
    const flags = sourcePattern.flags.includes("g") ? sourcePattern.flags : `${sourcePattern.flags}g`;
    const pattern = new RegExp(sourcePattern.source, flags);
    for (const match of String(text ?? "").matchAll(pattern)) {
      positions.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
    }
  }
  return positions;
}

function rangeDistance(left, right) {
  if (left.end < right.start) return right.start - left.end;
  if (right.end < left.start) return left.start - right.end;
  return 0;
}

function rateIsAssociatedWithService(evidence, kind, name, value) {
  const signature = normalizeRateIdentity(value);
  if (!signature) return false;
  const candidateRates = rateMatches(evidence).filter((rate) => rate.signature === signature);
  if (!candidateRates.length) return false;

  const targetPositions = patternPositions(evidence, targetCuePatterns(kind, name));
  if (!targetPositions.length) return false;

  const otherPositions = patternPositions(evidence, KNOWN_SERVICE_CUE_PATTERNS)
    .filter((position) => !targetPositions.some((target) => rangeDistance(position, target) === 0));

  return candidateRates.some((rate) => {
    const targetDistance = Math.min(...targetPositions.map((target) => rangeDistance(rate, target)));
    if (!otherPositions.length) return true;
    const otherDistance = Math.min(...otherPositions.map((other) => rangeDistance(rate, other)));
    return targetDistance < otherDistance;
  });
}

export function serviceEvidenceIsGroundedInSource(sourceValue, evidenceValue) {
  const source = normalizeComparable(sourceValue);
  const evidence = normalizeComparable(evidenceValue);
  if (!source || !evidence || evidence.length < 3) return false;
  return (` ${source} `).includes(` ${evidence} `);
}

function inferServiceKind(kindValue, nameValue) {
  const requested = String(kindValue ?? "").trim().toLowerCase();
  const name = normalizeComparable(nameValue);

  if (/(?:^|\s)(?:dich vu chung|dv chung|phi chung|phi dich vu chung|phi dv chung)(?:\s|$)/u.test(name)) return "common";
  if (/(?:^|\s)(?:mang|internet|wifi)(?:\s|$)/u.test(name)) return "internet";
  if (/(?:^|\s)(?:gui xe|xe may|parking|phi xe)(?:\s|$)/u.test(name)) return "parking";
  if (/(?:^|\s)(?:ve sinh|rac)(?:\s|$)/u.test(name)) return "cleaning";
  if (/(?:^|\s)(?:may giat|giat chung)(?:\s|$)/u.test(name)) return "washing";
  return SERVICE_KINDS.has(requested) ? requested : "other";
}

function canonicalServiceName(kind, nameValue) {
  const name = cleanField(nameValue, MAX_SERVICE_NAME_LENGTH);
  const comparable = normalizeComparable(name);

  if (kind === "common") return "Dịch vụ chung";
  if (kind === "internet") return "Mạng";
  if (kind === "parking") return "Gửi xe";
  if (kind === "washing") return "Máy giặt chung";
  if (kind === "cleaning") {
    return /(?:^|\s)rac(?:\s|$)/u.test(comparable) && !/(?:^|\s)ve sinh(?:\s|$)/u.test(comparable)
      ? "Rác"
      : "Vệ sinh";
  }
  if (comparable === "dien nuoc" || comparable === "nuoc dien") return "Điện + nước";
  if (!name) return "";
  return name.charAt(0).toLocaleUpperCase("vi") + name.slice(1);
}

function canonicalIncludedService(value) {
  const clean = cleanField(value, MAX_SERVICE_NAME_LENGTH);
  const comparable = normalizeComparable(clean);
  if (!clean || !comparable) return "";

  if (/^(?:mang|internet|wifi)$/u.test(comparable)) return "Mạng";
  if (/^(?:ve sinh|vs)$/u.test(comparable)) return "Vệ sinh";
  if (/^(?:rac|rac thai)$/u.test(comparable)) return "Rác";
  if (/^(?:may giat|may giat chung|giat chung)$/u.test(comparable)) return "Máy giặt chung";
  if (/^(?:gui xe|xe may|parking|phi xe)$/u.test(comparable)) return "Gửi xe";
  if (/^(?:dien chung|dien hanh lang)$/u.test(comparable)) return "Điện chung";
  if (/^(?:nuoc chung)$/u.test(comparable)) return "Nước chung";
  if (/^dien$/u.test(comparable)) return "Điện";
  if (/^nuoc$/u.test(comparable)) return "Nước";
  if (/^camera$/u.test(comparable)) return "Camera";
  if (/^bao ve$/u.test(comparable)) return "Bảo vệ";
  return clean.charAt(0).toLocaleUpperCase("vi") + clean.slice(1);
}

function includedServiceIsGroundedInEvidence(evidenceValue, includeValue) {
  const evidence = normalizeComparable(evidenceValue);
  const include = normalizeComparable(includeValue);
  if (!evidence || !include) return false;

  const aliases = new Map([
    ["mang", ["mang", "internet", "wifi"]],
    ["ve sinh", ["ve sinh", "vs"]],
    ["rac", ["rac", "rac thai"]],
    ["may giat chung", ["may giat", "may giat chung", "giat chung"]],
    ["gui xe", ["gui xe", "xe may", "parking", "phi xe"]],
    ["dien chung", ["dien chung", "dien hanh lang"]],
    ["nuoc chung", ["nuoc chung"]],
    ["dien", ["dien"]],
    ["nuoc", ["nuoc"]],
    ["camera", ["camera"]],
    ["bao ve", ["bao ve"]],
  ]);
  const candidates = aliases.get(include) || [include];
  return candidates.some((candidate) => (` ${evidence} `).includes(` ${candidate} `));
}

function commonBundleIsGrounded(evidence, includes, value) {
  if (!Array.isArray(includes) || includes.length < 2) return false;
  const rates = rateMatches(evidence);
  const signature = normalizeRateIdentity(value);
  if (rates.length !== 1 || !signature || rates[0].signature !== signature) return false;

  const includeNames = new Set(includes.map(normalizeComparable).filter(Boolean));
  if (includeNames.size === 2 && includeNames.has("dien") && includeNames.has("nuoc")) return false;

  const normalizedEvidence = normalizeComparable(evidence);
  return /[+&,]/u.test(String(evidence ?? ""))
    || /(?:^|\s)(?:va|voi|gom|bao gom)(?:\s|$)/u.test(normalizedEvidence);
}

function itemIsStandaloneElectricityOrWater(kind, name) {
  if (["common", "internet", "parking", "cleaning", "washing"].includes(kind)) return false;
  const comparable = normalizeComparable(name);
  return /^(?:dien|dien sinh hoat|electricity|nuoc|water)$/u.test(comparable);
}

function formatDynamicServiceValue(value) {
  return cleanField(value, MAX_SERVICE_VALUE_LENGTH)
    .replace(/\s*\/\s*/g, "/")
    .replace(/\bK\b/g, "k")
    .replace(/\/(?:1\s*)?(?:ng|người|nguoi)$/iu, "/người")
    .replace(/\/(?:1\s*)?(?:m3|m³|khối|khoi)$/iu, "/khối")
    .replace(/\/(?:1\s*)?(?:phòng|phong)$/iu, "/phòng")
    .replace(/\/(?:1\s*)?xe$/iu, "/xe")
    .replace(/\/(?:1\s*)?(?:tháng|thang)$/iu, "/tháng")
    .replace(/\/(?:1\s*)?(?:số|so|kwh)$/iu, "/số");
}

function removePackageMemberDuplicates(items) {
  const packages = items.filter((item) => item.kind === "common");
  return items.filter((item) => {
    if (item.kind === "common") return true;
    return !packages.some((pkg) => (
      pkg.includes.some((include) => normalizeComparable(include) === normalizeComparable(item.name))
      && normalizeRateIdentity(pkg.value) === normalizeRateIdentity(item.value)
      && normalizeComparable(pkg._evidence) === normalizeComparable(item._evidence)
    ));
  });
}

export function normalizeDynamicServiceItems(sourceValue, itemValues) {
  if (!Array.isArray(itemValues)) return [];
  const normalized = [];
  const seen = new Set();

  for (const raw of itemValues.slice(0, MAX_SERVICE_ITEMS)) {
    const evidence = cleanEvidence(raw?.evidence);
    const rawName = cleanField(raw?.name, MAX_SERVICE_NAME_LENGTH);
    const kind = inferServiceKind(raw?.kind, rawName);
    const name = canonicalServiceName(kind, rawName);
    const rawValue = cleanField(raw?.value, MAX_SERVICE_VALUE_LENGTH);
    const value = formatDynamicServiceValue(rawValue);

    if (!name || !value || !evidence) continue;
    if (!serviceEvidenceIsGroundedInSource(sourceValue, evidence)) continue;
    if (!rateMatches(evidence).some((rate) => rate.signature === normalizeRateIdentity(rawValue))) continue;

    const includes = kind === "common"
      ? [...new Set((Array.isArray(raw?.includes) ? raw.includes : [])
        .slice(0, MAX_SERVICE_INCLUDES)
        .map(canonicalIncludedService)
        .filter((include) => include && includedServiceIsGroundedInEvidence(evidence, include)))]
      : [];

    const groundedRate = rateIsAssociatedWithService(evidence, kind, rawName || name, rawValue)
      || (kind === "common" && commonBundleIsGrounded(evidence, includes, rawValue));
    if (!groundedRate) continue;
    if (itemIsStandaloneElectricityOrWater(kind, name)) continue;

    const identity = `${kind}|${normalizeComparable(name)}|${normalizeRateIdentity(value)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    normalized.push({ kind, name, value, includes, _evidence: evidence });
  }

  return removePackageMemberDuplicates(normalized).map(({ _evidence, ...item }) => item);
}

export function reconcileDynamicServiceItems(sourceValue, aiItems) {
  const sourceItems = extractSourceDynamicServiceItems(sourceValue);
  const sourceBySemantic = new Map(sourceItems.map((item) => [semanticIdentity(item), item]));
  const merged = [];

  for (const item of Array.isArray(aiItems) ? aiItems : []) {
    const name = String(item?.name ?? "").trim();
    const value = String(item?.value ?? "").trim();
    const kind = String(item?.kind ?? "other").trim() || "other";
    if (!name || !value) continue;

    const normalizedItem = { kind, name, value, includes: mergeIncludes([], item?.includes) };
    const sourceEquivalent = sourceBySemantic.get(semanticIdentity(normalizedItem));
    if (sourceEquivalent && normalizeRateIdentity(sourceEquivalent.value) !== normalizeRateIdentity(value)) continue;
    merged.push(normalizedItem);
  }

  merged.push(...sourceItems);
  return resolvePackageMembership(dedupeItems(merged)).slice(0, MAX_SERVICE_ITEMS);
}

function sharedUtilityRateIdentities(serviceItems) {
  return new Set((Array.isArray(serviceItems) ? serviceItems : [])
    .filter((item) => normalizeComparable(item?.name) === "dien nuoc")
    .map((item) => normalizeRateIdentity(item?.value))
    .filter(Boolean));
}

export function reconcileUtilityServiceFields(serviceFields = {}, serviceItems = []) {
  const sharedRates = sharedUtilityRateIdentities(serviceItems);
  const electricity = String(serviceFields?.electricity || "").trim();
  const water = String(serviceFields?.water || "").trim();
  return {
    ...serviceFields,
    electricity: sharedRates.has(normalizeRateIdentity(electricity)) ? "" : electricity,
    water: sharedRates.has(normalizeRateIdentity(water)) ? "" : water,
    items: Array.isArray(serviceItems) ? serviceItems : [],
  };
}

function summaryFound(summary) {
  return Boolean(
    summary.address
    || summary.rooms.length
    || summary.roomType
    || summary.elevator
    || summary.furniture
    || summary.services.electricity
    || summary.services.water
    || summary.services.items.length
  );
}

export function extractDeterministicRoomSummary(sourceValue) {
  const source = normalizeRoomSummarySource(sourceValue);
  const serviceItems = extractSourceDynamicServiceItems(source);
  const services = reconcileUtilityServiceFields(extractSourceUtilityServices(source), serviceItems);
  const summary = {
    address: extractSourceAddress(source),
    rooms: normalizeDetectedRooms(source, []),
    roomType: extractSourceRoomType(source),
    elevator: elevatorStatusInSource(source),
    furniture: extractSourceFurniture(source),
    services,
  };
  return { ...summary, found: summaryFound(summary) };
}

function sourceHasFurnitureCue(source) {
  return /(?<![\p{L}\p{N}_])(?:nội\s*thất|noi\s*that|đồ\s*đạc|do\s*dac|trang\s*bị|trang\s*bi|full\s*đồ|full\s*do|giường|giuong|tủ|tu|điều\s*hòa|dieu\s*hoa|nóng\s*lạnh|nong\s*lanh|bếp|bep|sofa|tủ\s*lạnh|tu\s*lanh|máy\s*giặt|may\s*giat)(?![\p{L}\p{N}_])/iu.test(source);
}

function sourceHasServiceCue(source) {
  return /(?<![\p{L}\p{N}_])(?:dịch\s*vụ|dich\s*vu|dv|phí|phi|điện|dien|nước|nuoc|mạng|mang|internet|wifi|vệ\s*sinh|ve\s*sinh|rác|rac|gửi\s*xe|gui\s*xe|máy\s*giặt\s*chung|may\s*giat\s*chung|bảo\s*vệ|bao\s*ve|camera)(?![\p{L}\p{N}_])/iu.test(source);
}

function sourceLooksLikeAddress(source) {
  return /(?<![\p{L}\p{N}_])(?:địa\s*chỉ|dia\s*chi|address|ngõ|ngo|hẻm|hem|đường|duong|phố|pho|phường|phuong|quận|quan)(?![\p{L}\p{N}_])/iu.test(source);
}

function roomFactsNeedAssist(source, rooms) {
  const hasRoomCue = /(?<![\p{L}\p{N}_])(?:phòng|phong|room|trống|trong|available|availability|còn|con|sắp|sap)(?![\p{L}\p{N}_])/iu.test(source)
    || /\bp\s*[-:]?\s*\d{1,4}[a-z]?\b/iu.test(source)
    || /(?<![\p{L}\p{N}_])(?:giá\s+thuê|gia\s+thue|giá\s+phòng|gia\s+phong|tiền\s+phòng|tien\s+phong|rent)(?![\p{L}\p{N}_])/iu.test(source);
  if (!hasRoomCue) return false;
  if (!rooms.length) return true;

  const hasPriceCue = /(?<![\p{L}\p{N}_])(?:giá|gia|price|rent)(?![\p{L}\p{N}_])/iu.test(source);
  const hasAvailabilityCue = /(?<![\p{L}\p{N}_])(?:trống|trong|available|availability|vào\s*luôn|vao\s*luon|sắp\s*trống|sap\s*trong)(?![\p{L}\p{N}_])/iu.test(source);
  if (hasPriceCue && rooms.some((room) => !room.price)) return true;
  if (hasAvailabilityCue && rooms.some((room) => !room.availability)) return true;
  return false;
}

function rateLooksLikeRent(value) {
  const source = String(value ?? "").trim();
  if (/\/\s*(?:ng|người|nguoi|phòng|phong|xe|m3|m³|khối|khoi|số|so|kwh)\b/iu.test(source)) return false;
  return /^\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|m)\s*\d*(?:\s*\/\s*(?:tháng|thang))?$/iu.test(source);
}

function rentRateIsListingPrice(segment, rate) {
  if (!rateLooksLikeRent(rate?.value)) return false;
  const start = Math.max(0, (rate?.start ?? 0) - 48);
  const prefix = normalizeComparable(String(segment ?? "").slice(start, rate?.start ?? 0));
  return /(?:^|\s)(?:gia|gia thue|gia phong|tien phong|tien thue|rent|phong|room)(?:\s|$)/u.test(prefix)
    || /(?:^|\s)p\s*\d{1,4}[a-z]?(?:\s|$)/u.test(prefix);
}

function serviceFactsNeedAssist(source, services) {
  if (!sourceHasServiceCue(source)) return false;

  const known = new Set([
    services.electricity,
    services.water,
    ...services.items.map((item) => item.value),
  ].map(normalizeRateIdentity).filter(Boolean));

  for (const segment of sourceSegments(source)) {
    if (!sourceHasServiceCue(segment)) continue;
    for (const rate of rateMatches(segment)) {
      if (known.has(rate.signature) || rentRateIsListingPrice(segment, rate)) continue;
      return true;
    }
  }
  return false;
}

export function semanticAssistFields(sourceValue, deterministicValue = null) {
  const source = normalizeRoomSummarySource(sourceValue);
  const deterministic = deterministicValue || extractDeterministicRoomSummary(source);
  const fields = [];

  if (!deterministic.address && sourceLooksLikeAddress(source)) fields.push("address");
  if (roomFactsNeedAssist(source, deterministic.rooms)) fields.push("rooms");
  if (!deterministic.furniture && sourceHasFurnitureCue(source)) fields.push("furniture");
  if (serviceFactsNeedAssist(source, deterministic.services)) fields.push("services");

  return fields;
}

function serviceItemSchema() {
  return {
    type: "array",
    maxItems: MAX_SERVICE_ITEMS,
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["common", "internet", "parking", "cleaning", "washing", "other"] },
        name: { type: "string" },
        value: { type: "string" },
        includes: { type: "array", items: { type: "string" } },
        evidence: { type: "string" },
      },
      required: ["kind", "name", "value", "includes", "evidence"],
    },
  };
}

function semanticAssistSchema(fields) {
  const properties = {};
  const required = [];

  if (fields.includes("address")) {
    properties.address = { type: "string" };
    required.push("address");
  }
  if (fields.includes("rooms")) {
    properties.rooms = {
      type: "array",
      maxItems: MAX_ROOMS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          room: { type: "string" },
          price: { type: "string" },
          availability: { type: "string" },
        },
        required: ["room", "price", "availability"],
      },
    };
    required.push("rooms");
  }
  if (fields.includes("furniture")) {
    properties.furnitureAsImage = { type: "boolean" };
    properties.furnitureItems = { type: "array", maxItems: MAX_FURNITURE_ITEMS, items: { type: "string" } };
    required.push("furnitureAsImage", "furnitureItems");
  }
  if (fields.includes("services")) {
    properties.electricity = { type: "string" };
    properties.water = { type: "string" };
    properties.serviceItems = serviceItemSchema();
    required.push("electricity", "water", "serviceItems");
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function semanticAssistInstructions(fields) {
  const requested = fields.join(", ");
  return `Bạn là semantic fallback cho bộ đọc tin phòng trọ. Bộ rules đã xử lý phần chắc chắn.
Chỉ trả các nhóm được yêu cầu: ${requested}. Không trả thêm trường.

LUẬT BẮT BUỘC:
- Chỉ dùng dữ liệu có nguyên văn trong SOURCE; không suy đoán, không tự thêm địa danh/đơn vị/phòng/dịch vụ.
- rooms: chỉ phòng đang còn/trống/sắp trống; bỏ phòng đã cọc/đã giữ/đã thuê. Ghép đúng room-price-availability theo scope.
- address: lấy đúng địa chỉ căn đang đăng, không thêm Hà Nội/quận/phường nếu nguồn không viết.
- furniture: chỉ đồ/thiết bị đi cùng phòng; nếu "như ảnh/như hình" thì furnitureAsImage=true và items=[].
- electricity/water: chỉ phí điện/nước độc lập. Nếu một giá áp chung "điện nước" thì để electricity/water rỗng và tạo serviceItems name="Điện + nước".
- serviceItems: chỉ dịch vụ có phí hoặc miễn phí rõ ràng. Gói chung là một item common, không nhân phí gói sang từng thành phần.
- evidence của serviceItems phải là đoạn nguyên văn liên tục, ngắn, chứa đúng dịch vụ và đúng value.
- Nếu không chắc, dùng chuỗi rỗng hoặc mảng rỗng.`;
}

function extractAiObject(result) {
  const raw = result?.response ?? result?.result ?? result?.text ?? result;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const nested = raw.response ?? raw.result ?? raw.text;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) return nested;
    return raw;
  }

  const text = String(raw || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function runSemanticAssist(source, fields, env, model) {
  if (!fields.length || !env?.AI?.run) return null;

  const result = await env.AI.run(model, {
    messages: [
      { role: "system", content: semanticAssistInstructions(fields) },
      { role: "user", content: `SOURCE:\n${source}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: semanticAssistSchema(fields),
    },
    temperature: 0,
    max_tokens: 2000,
  });

  return extractAiObject(result) || {};
}

function mergeSemanticSummary(source, deterministic, detected, fields) {
  const address = deterministic.address || (
    fields.includes("address")
      ? (() => {
          const candidate = normalizeDetectedAddress(detected?.address);
          return candidate && addressIsGroundedInSource(source, candidate) ? candidate : "";
        })()
      : ""
  );

  const rooms = fields.includes("rooms")
    ? normalizeDetectedRooms(source, detected?.rooms)
    : deterministic.rooms;

  const furniture = deterministic.furniture || (
    fields.includes("furniture")
      ? normalizeDetectedFurniture(source, detected?.furnitureItems, detected?.furnitureAsImage)
      : ""
  );

  let serviceItems = deterministic.services.items;
  let serviceFields = {
    electricity: deterministic.services.electricity,
    water: deterministic.services.water,
  };

  if (fields.includes("services")) {
    const aiServiceItems = normalizeDynamicServiceItems(source, detected?.serviceItems);
    serviceItems = reconcileDynamicServiceItems(source, aiServiceItems);

    const aiFields = normalizeDetectedServices(source, detected?.electricity, detected?.water);
    serviceFields = {
      electricity: serviceFields.electricity || aiFields.electricity,
      water: serviceFields.water || aiFields.water,
    };
  }

  const services = reconcileUtilityServiceFields(serviceFields, serviceItems);
  const summary = {
    address,
    rooms,
    roomType: deterministic.roomType,
    elevator: deterministic.elevator,
    furniture,
    services,
  };
  return { ...summary, found: summaryFound(summary) };
}

export function isSaleRoomSummaryAiRoute(pathname) {
  return pathname === SALE_ROOM_SUMMARY_AI_PATH || pathname === LEGACY_SALE_ROOM_ADDRESS_AI_PATH;
}

export async function handleSaleRoomSummaryAiRequest(request, env) {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = await readJson(request);
  const source = normalizeRoomSummarySource(body?.source);
  if (!source) return json({ error: "ROOM_SUMMARY_SOURCE_INVALID" }, 400);

  const model = cleanText(env.SALE_ROOM_SUMMARY_AI_MODEL, 160) || DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL;
  const deterministic = extractDeterministicRoomSummary(source);
  const fields = semanticAssistFields(source, deterministic);

  let detected = null;
  let aiUsed = false;

  if (fields.length && env?.AI?.run) {
    try {
      detected = await runSemanticAssist(source, fields, env, model);
      aiUsed = Boolean(detected);
    } catch (error) {
      console.warn("Joy Sale semantic assist unavailable", error?.message || error);
    }
  }

  const summary = detected
    ? mergeSemanticSummary(source, deterministic, detected, fields)
    : deterministic;

  if (!summary.found && fields.length && !env?.AI?.run) {
    return json({ error: "AI_UNAVAILABLE" }, 503);
  }

  return json({
    ok: true,
    found: summary.found,
    provider: aiUsed ? "rules+workers-ai" : "rules",
    model,
    address: summary.address,
    rooms: summary.rooms,
    roomType: summary.roomType,
    elevator: summary.elevator,
    furniture: summary.furniture,
    services: summary.services,
  });
}
