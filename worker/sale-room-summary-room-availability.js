import { clean, fold, normalizeRoomSummarySource } from "./sale-room-summary-foundation.js";

const FULL_DATE_RE = /^(?:\d{1,2}\s*\/\s*(?:\d{1,2}(?:\s*\/\s*\d{2,4})?|\d{4})|\d{4}\s*-\s*\d{1,2}\s*-\s*\d{1,2})$/u;
const FULL_AVAILABILITY_TEXT_RE = /^(?:vào\s+luôn|vao\s+luon|ở\s+luôn|o\s+luon|trống\s+ngay|trong\s+ngay|vào\s+ngay|vao\s+ngay|cuối\s+tháng|cuoi\s+thang|đầu\s+tháng|dau\s+thang|giữa\s+tháng|giua\s+thang)$/iu;
const ROOM_WITH_AVAILABILITY_RE = /(?<![\p{L}\p{N}_])((?:p\s*[-:]?\s*)?\d{2,4}|[a-z]{1,3}\d{1,4}[a-z]?)\s*\(\s*([^()]{1,40}?)\s*\)/giu;

function roomIdentity(value) {
  const normalized = fold(value)
    .replace(/^(?:phong|room)\s+/u, "")
    .replace(/\s+/g, "");
  const numeric = normalized.match(/^p?(\d{1,4})$/u);
  if (numeric) return `number:${numeric[1]}`;
  if (/^[a-z]{1,3}\d{1,4}[a-z]?$/u.test(normalized)) return `code:${normalized}`;
  return "";
}

function canonicalAvailability(value) {
  const candidate = clean(value, 60);
  if (!candidate) return "";
  if (FULL_DATE_RE.test(candidate)) return candidate.replace(/\s*\/\s*/g, "/").replace(/\s*-\s*/g, "-");
  return FULL_AVAILABILITY_TEXT_RE.test(candidate) ? candidate.toLocaleLowerCase("vi") : "";
}

export function extractParenthesizedRoomAvailability(sourceValue) {
  const source = normalizeRoomSummarySource(sourceValue);
  const values = new Map();
  const conflicted = new Set();

  for (const match of source.matchAll(ROOM_WITH_AVAILABILITY_RE)) {
    const identity = roomIdentity(match[1]);
    const availability = canonicalAvailability(match[2]);
    if (!identity || !availability || conflicted.has(identity)) continue;

    const existing = values.get(identity);
    if (existing && fold(existing) !== fold(availability)) {
      values.delete(identity);
      conflicted.add(identity);
      continue;
    }
    values.set(identity, availability);
  }

  return values;
}

export function reconcileParenthesizedRoomAvailability(sourceValue, roomValues) {
  if (!Array.isArray(roomValues)) return [];
  const explicit = extractParenthesizedRoomAvailability(sourceValue);
  return roomValues.map((room) => {
    const identity = roomIdentity(room?.room);
    const availability = identity ? explicit.get(identity) : "";
    return availability ? { ...room, availability } : { ...room };
  });
}
