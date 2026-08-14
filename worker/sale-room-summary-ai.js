import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

export const SALE_ROOM_SUMMARY_AI_PATH = "/api/sales/room-summary/extract";
export const LEGACY_SALE_ROOM_ADDRESS_AI_PATH = "/api/sales/room-summary/address";
export const DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const MAX_SOURCE_LENGTH = 12000;
const MAX_ADDRESS_LENGTH = 320;
const MAX_ROOM_FIELD_LENGTH = 220;
const MAX_ROOMS = 24;

const ROOM_SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    address: { type: "string" },
    rooms: {
      type: "array",
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
    },
  },
  required: ["address", "rooms"],
};

const EXPLICIT_UNAVAILABLE_PATTERNS = Object.freeze([
  /\bda coc\b/u,
  /\bcoc roi\b/u,
  /\bda giu\b/u,
  /\bgiu roi\b/u,
  /\bda thue\b/u,
  /\bthue roi\b/u,
  /\bhet phong\b/u,
]);

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

  if (!env?.AI?.run) return json({ error: "AI_UNAVAILABLE" }, 503);

  const model = cleanText(env.SALE_ROOM_SUMMARY_AI_MODEL, 160)
    || DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL;

  try {
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: roomSummaryInstructions() },
        { role: "user", content: source },
      ],
      response_format: {
        type: "json_schema",
        json_schema: ROOM_SUMMARY_SCHEMA,
      },
      temperature: 0,
      max_tokens: 900,
    });

    const detected = extractAiObject(result) || {};
    const addressCandidate = normalizeDetectedAddress(detected.address);
    const address = addressCandidate && addressIsGroundedInSource(source, addressCandidate)
      ? addressCandidate
      : "";

    if (addressCandidate && !address) {
      console.warn("Joy Sale room-summary AI rejected an ungrounded address", addressCandidate);
    }

    const rooms = normalizeDetectedRooms(source, detected.rooms);

    return json({
      ok: true,
      found: Boolean(address || rooms.length),
      provider: "workers-ai",
      model,
      address,
      rooms,
    });
  } catch (error) {
    console.warn("Joy Sale room-summary AI unavailable", error?.message || error);
    return json({ error: "AI_FAILED" }, 503);
  }
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

export function addressIsGroundedInSource(sourceValue, addressValue) {
  return valueIsGroundedInSource(sourceValue, addressValue);
}

export function roomFieldIsGroundedInSource(sourceValue, fieldValue) {
  return valueIsGroundedInSource(sourceValue, fieldValue);
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
      if (fieldIsNearestToRoom(clause, room, field, rooms)) return true;
    }
  }

  // Shared values are accepted only when the source itself marks the clause as a general price/vacancy fact
  // and there is no other room-like token left after removing the candidate value.
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

export function normalizeDetectedRooms(sourceValue, roomValues) {
  if (!Array.isArray(roomValues)) return [];

  const candidates = roomValues.slice(0, MAX_ROOMS).map((raw) => ({
    roomCandidate: normalizeDetectedRoomField(raw?.room),
    priceCandidate: normalizeDetectedRoomField(raw?.price),
    availabilityCandidate: normalizeDetectedRoomField(raw?.availability),
  }));

  const groundedRoomValues = candidates.map(({ roomCandidate }) => (
    roomCandidate && roomFieldIsGroundedInSource(sourceValue, roomCandidate)
      ? roomCandidate
      : ""
  ));
  const allRooms = groundedRoomValues.filter(Boolean);
  const validated = [];

  candidates.forEach((candidate, index) => {
    const { roomCandidate, priceCandidate, availabilityCandidate } = candidate;
    const room = groundedRoomValues[index];

    // If AI invented or rewrote a room identifier, do not salvage unrelated values from that row.
    if (roomCandidate && !room) return;
    if (room && roomIsExplicitlyUnavailableInSource(sourceValue, room)) return;

    const price = priceCandidate
      && roomFieldIsAssociatedInSource(sourceValue, room, priceCandidate, allRooms, "price")
      ? priceCandidate
      : "";
    const availability = availabilityCandidate
      && roomFieldIsAssociatedInSource(sourceValue, room, availabilityCandidate, allRooms, "availability")
      ? availabilityCandidate
      : "";

    if (!room && !price && !availability) return;
    validated.push({ room, price, availability });
  });

  return mergeRoomFacts(validated);
}

function roomSummaryInstructions() {
  return `Bạn là bộ trích xuất dữ liệu tin phòng trọ/căn hộ bằng tiếng Việt.
Nhiệm vụ hiện tại chỉ gồm 2 phần: xác định địa chỉ và xác định các phòng/căn hiện đang cần cho thuê cùng giá và thời gian trống của từng phòng.

Trả về đúng JSON theo schema:
{
  "address": "...",
  "rooms": [
    { "room": "...", "price": "...", "availability": "..." }
  ]
}

QUY TẮC CHUNG:
- Chỉ dùng thông tin có thật trong nội dung nguồn. Tuyệt đối không suy đoán, bổ sung hoặc tự chuẩn hóa thành dữ liệu mới.
- Không lấy số điện thoại, hoa hồng, tên nguồn, link, mã nguồn, nội thất, dịch vụ hoặc ghi chú khác vào các trường này.
- Nếu một trường không có hoặc không chắc chắn, trả chuỗi rỗng cho trường đó.

ĐỊA CHỈ:
- Giữ nguyên cách trích xuất địa chỉ: chỉ lấy địa chỉ của căn/phòng đang đăng.
- Không tự thêm Hà Nội, quận, phường, ngõ, số nhà hoặc bất kỳ địa danh nào nguồn không viết.
- Có thể bỏ nhãn "Địa chỉ:", emoji và ký hiệu trang trí; chỉ dọn khoảng trắng và dấu câu thừa.
- Nếu có nhiều địa chỉ và không chắc địa chỉ nào thuộc căn/phòng đang đăng, để address rỗng.

PHÒNG / GIÁ / THỜI GIAN TRỐNG:
- rooms chỉ gồm các phòng/căn đang được đăng cho thuê hoặc được ghi là còn/trống/sắp trống. Không đưa phòng đã thuê, đã cọc, đã giữ hoặc chỉ xuất hiện trong ghi chú/lịch sử.
- room là đúng mã/tên phòng nguồn viết, ví dụ P201, 302, A05. Không tự đổi P201 thành "Phòng 201" và không tự tạo số phòng.
- Nếu tin chỉ nói về một phòng cho thuê nhưng không có mã/tên phòng, có thể để room rỗng và vẫn ghi price/availability nếu chúng rõ ràng.
- price giữ đúng cách nguồn viết, ví dụ 4tr5, 5.1tr, 5tr1/tháng. Không đổi đơn vị, không tính toán và không tự thêm "/tháng".
- availability giữ đúng thông tin nguồn viết, ví dụ "vào luôn", "1/9", "trống 15/8", "cuối tháng". Không tự đổi cụm tương đối thành ngày cụ thể.
- Nếu nhiều phòng có giá hoặc ngày trống khác nhau, phải ghép đúng giá và thời gian với đúng phòng.
- Nếu một giá hoặc thời gian được ghi chung cho nhiều phòng, chỉ áp dụng cho tất cả khi quan hệ đó thật sự rõ từ nguồn.
- Nếu không chắc giá/thời gian thuộc phòng nào, để trường đó rỗng thay vì gán nhầm.
- Không gộp nhiều phòng vào một phần tử rooms; mỗi phòng/căn là một phần tử riêng.`;
}

function valueIsGroundedInSource(sourceValue, candidateValue) {
  const source = normalizeComparable(sourceValue);
  const candidate = normalizeComparable(candidateValue);
  return containsNormalizedPhrase(source, candidate);
}

function sourceClauses(value) {
  return String(value ?? "")
    .split(/[\n;|•]+/u)
    .map(normalizeComparable)
    .filter(Boolean);
}

function sourceStatusClauses(value) {
  return String(value ?? "")
    .split(/[\n;,|•]+/u)
    .map(normalizeComparable)
    .filter(Boolean);
}

function containsNormalizedPhrase(source, candidate) {
  if (!source || !candidate) return false;
  return ` ${source} `.includes(` ${candidate} `);
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
    return distances.some(({ room, distance }) => room === targetRoom && distance === minimum);
  });
}

function sharedFieldClauseIsExplicit(clause, field, fieldKind) {
  const kindMatches = fieldKind === "price"
    ? /\b(?:gia|price|rent)\b/u.test(clause)
    : fieldKind === "availability"
      ? /\b(?:trong|available|availability|vao luon)\b/u.test(clause)
      : false;
  if (!kindMatches) return false;

  const withoutField = removeNormalizedPhrase(clause, field);
  return !containsOtherRoomLikeToken(withoutField);
}

function removeNormalizedPhrase(source, candidate) {
  if (!source || !candidate) return source;
  return (` ${source} `).split(` ${candidate} `).join(" ").replace(/\s+/g, " ").trim();
}

function containsOtherRoomLikeToken(value) {
  const source = String(value || "");
  return /\b(?:p\d+[a-z]?|[a-z]{1,3}\d{2,4})\b/u.test(source)
    || /\b(?:phong|room)\s+\d{1,4}\b/u.test(source)
    || /\b\d{2,4}\b/u.test(source);
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

function mergeSingleFact(current, incoming) {
  if (!current) return incoming || "";
  if (!incoming) return current;
  return normalizeComparable(current) === normalizeComparable(incoming) ? current : "";
}

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

function extractAiObject(result) {
  const raw = result?.response ?? result?.result ?? result?.text ?? result;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (Object.hasOwn(raw, "address") || Object.hasOwn(raw, "rooms")) return raw;
    const nested = raw.response ?? raw.result ?? raw.text;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) return nested;
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

function cleanText(value, maximum) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}
