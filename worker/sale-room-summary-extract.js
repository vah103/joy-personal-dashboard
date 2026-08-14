import { DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL } from "./sale-room-summary-ai.js";
import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

export const SALE_ROOM_SUMMARY_AI_EXTRACT_PATH = "/api/sales/room-summary/analyze";

const MAX_SOURCE_LENGTH = 12_000;
const MAX_EVIDENCE_ITEMS = 3;
const MAX_EVIDENCE_LENGTH = 500;
const MAX_ROOMS = 40;
const MAX_SERVICES = 12;
const MAX_NOTES = 10;

const SERVICE_LABELS = Object.freeze({
  electricity: "Điện",
  water: "Nước",
  internet: "Mạng",
  common: "Dịch vụ chung",
  parking: "Gửi xe",
  fridge: "Tủ lạnh",
  laundry: "Giặt sấy",
  other: "Khác",
});

const SERVICE_EVIDENCE_ALIASES = Object.freeze({
  electricity: ["dien", "electric"],
  water: ["nuoc", "water"],
  internet: ["wifi", "wi-fi", "internet", "mang"],
  common: ["dich vu", "phi dich vu", "dvc", "ve sinh", "vsinh"],
  parking: ["gui xe", "de xe", "parking", "xe"],
  fridge: ["tu lanh", "fridge"],
  laundry: ["giat say", "giat", "laundry"],
  other: [],
});

const EVIDENCED_VALUE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: "string" },
    evidence: {
      type: "array",
      maxItems: MAX_EVIDENCE_ITEMS,
      items: { type: "string" },
    },
  },
  required: ["value", "evidence"],
});

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    address: EVIDENCED_VALUE_SCHEMA,
    price: EVIDENCED_VALUE_SCHEMA,
    availability: EVIDENCED_VALUE_SCHEMA,
    roomType: EVIDENCED_VALUE_SCHEMA,
    elevator: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "string", enum: ["yes", "no", "unknown"] },
        evidence: {
          type: "array",
          maxItems: MAX_EVIDENCE_ITEMS,
          items: { type: "string" },
        },
      },
      required: ["value", "evidence"],
    },
    rooms: {
      type: "array",
      maxItems: MAX_ROOMS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string" },
          price: { type: "string" },
          availability: { type: "string" },
          evidence: {
            type: "array",
            maxItems: MAX_EVIDENCE_ITEMS,
            items: { type: "string" },
          },
        },
        required: ["code", "price", "availability", "evidence"],
      },
    },
    furniture: EVIDENCED_VALUE_SCHEMA,
    services: {
      type: "array",
      maxItems: MAX_SERVICES,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", enum: Object.keys(SERVICE_LABELS) },
          value: { type: "string" },
          evidence: {
            type: "array",
            maxItems: MAX_EVIDENCE_ITEMS,
            items: { type: "string" },
          },
        },
        required: ["key", "value", "evidence"],
      },
    },
    notes: {
      type: "array",
      maxItems: MAX_NOTES,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          value: { type: "string" },
          evidence: {
            type: "array",
            maxItems: MAX_EVIDENCE_ITEMS,
            items: { type: "string" },
          },
        },
        required: ["value", "evidence"],
      },
    },
  },
  required: [
    "address",
    "price",
    "availability",
    "roomType",
    "elevator",
    "rooms",
    "furniture",
    "services",
    "notes",
  ],
};

export function isSaleRoomSummaryAiExtractRoute(pathname) {
  return pathname === SALE_ROOM_SUMMARY_AI_EXTRACT_PATH;
}

export async function handleSaleRoomSummaryAiExtractRequest(request, env) {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = await readJson(request);
  const source = normalizeRoomListingSource(body?.source);
  if (!source) return json({ error: "ROOM_SUMMARY_SOURCE_REQUIRED" }, 400);

  if (!env?.AI?.run) {
    return json({ ok: true, applied: false, reason: "ai-unavailable" });
  }

  const model = cleanText(env.SALE_ROOM_SUMMARY_AI_MODEL, 160)
    || DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL;

  try {
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: roomSummaryExtractionInstructions() },
        { role: "user", content: source },
      ],
      response_format: {
        type: "json_schema",
        json_schema: EXTRACTION_SCHEMA,
      },
      temperature: 0,
      max_tokens: 1800,
    });

    const extraction = sanitizeRoomSummaryAiExtraction(extractAiObject(result));
    if (!extraction) {
      return json({ ok: true, applied: false, reason: "invalid-ai-output", model });
    }

    const validation = validateRoomSummaryAiExtraction(source, extraction);
    if (!validation.valid) {
      console.warn("Joy Sale room-summary AI extraction rejected", validation.reason);
      return json({ ok: true, applied: false, reason: validation.reason, model });
    }

    const canonicalListing = buildCanonicalRoomListing(extraction);
    if (!canonicalListing) {
      return json({ ok: true, applied: false, reason: "empty-ai-extraction", model });
    }

    return json({
      ok: true,
      applied: true,
      provider: "workers-ai",
      model,
      extraction,
      canonicalListing,
    });
  } catch (error) {
    console.warn("Joy Sale room-summary AI extraction unavailable", error?.message || error);
    return json({ ok: true, applied: false, reason: "ai-failed", model });
  }
}

export function normalizeRoomListingSource(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim()
    .slice(0, MAX_SOURCE_LENGTH);
}

export function sanitizeRoomSummaryAiExtraction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const elevatorValue = ["yes", "no", "unknown"].includes(value.elevator?.value)
    ? value.elevator.value
    : "unknown";

  const rooms = (Array.isArray(value.rooms) ? value.rooms : [])
    .slice(0, MAX_ROOMS)
    .map((room) => ({
      code: sanitizeRoomCode(room?.code),
      price: cleanText(room?.price, 120),
      availability: cleanText(room?.availability, 160),
      evidence: sanitizeEvidence(room?.evidence),
    }))
    .filter((room) => room.code || room.price || room.availability);

  const services = (Array.isArray(value.services) ? value.services : [])
    .slice(0, MAX_SERVICES)
    .map((service) => ({
      key: normalizeServiceKey(service?.key),
      value: cleanText(service?.value, 500),
      evidence: sanitizeEvidence(service?.evidence),
    }))
    .filter((service) => service.key && service.value);

  const notes = (Array.isArray(value.notes) ? value.notes : [])
    .slice(0, MAX_NOTES)
    .map((note) => ({
      value: cleanText(note?.value, 500),
      evidence: sanitizeEvidence(note?.evidence),
    }))
    .filter((note) => note.value);

  return {
    address: sanitizeEvidencedValue(value.address, 500),
    price: sanitizeEvidencedValue(value.price, 300),
    availability: sanitizeEvidencedValue(value.availability, 300),
    roomType: sanitizeEvidencedValue(value.roomType, 200),
    elevator: {
      value: elevatorValue,
      evidence: sanitizeEvidence(value.elevator?.evidence),
    },
    rooms,
    furniture: sanitizeEvidencedValue(value.furniture, 1000),
    services,
    notes,
  };
}

export function validateRoomSummaryAiExtraction(sourceValue, candidateValue) {
  const source = normalizeRoomListingSource(sourceValue);
  const candidate = sanitizeRoomSummaryAiExtraction(candidateValue);
  if (!source || !candidate) return { valid: false, reason: "invalid-shape" };

  for (const [name, field] of [
    ["address", candidate.address],
    ["price", candidate.price],
    ["availability", candidate.availability],
    ["room-type", candidate.roomType],
    ["furniture", candidate.furniture],
  ]) {
    const validation = validateEvidencedValue(source, field, name);
    if (!validation.valid) return validation;
  }

  if (candidate.address.value && !addressLooksSupported(candidate.address.value, candidate.address.evidence)) {
    return { valid: false, reason: "address-not-supported" };
  }
  if (candidate.roomType.value && !roomTypeLooksSupported(candidate.roomType.value, candidate.roomType.evidence)) {
    return { valid: false, reason: "room-type-not-supported" };
  }

  const elevatorValidation = validateElevator(source, candidate.elevator);
  if (!elevatorValidation.valid) return elevatorValidation;

  const roomKeys = new Set();
  for (const room of candidate.rooms) {
    if (!room.code) return { valid: false, reason: "room-code-missing" };
    const evidenceValidation = validateEvidenceAgainstSource(source, room.evidence, true);
    if (!evidenceValidation.valid) return { valid: false, reason: `room-${evidenceValidation.reason}` };
    const evidenceText = room.evidence.join("\n");
    if (!roomCodeSupported(room.code, evidenceText)) return { valid: false, reason: "room-code-not-supported" };
    if (!numbersSupported(room.price, evidenceText)) return { valid: false, reason: "room-price-not-supported" };
    if (!numbersSupported(room.availability, evidenceText)) return { valid: false, reason: "room-availability-not-supported" };

    const key = foldText(room.code);
    if (roomKeys.has(key)) return { valid: false, reason: "duplicate-room" };
    roomKeys.add(key);
  }

  for (const service of candidate.services) {
    const evidenceValidation = validateEvidenceAgainstSource(source, service.evidence, true);
    if (!evidenceValidation.valid) return { valid: false, reason: `service-${evidenceValidation.reason}` };
    const evidenceText = service.evidence.join("\n");
    if (!numbersSupported(service.value, evidenceText)) return { valid: false, reason: "service-numbers-not-supported" };
    if (!serviceKeySupported(service.key, evidenceText)) return { valid: false, reason: "service-key-not-supported" };
  }

  for (const note of candidate.notes) {
    const evidenceValidation = validateEvidenceAgainstSource(source, note.evidence, true);
    if (!evidenceValidation.valid) return { valid: false, reason: `note-${evidenceValidation.reason}` };
    if (!numbersSupported(note.value, note.evidence.join("\n"))) {
      return { valid: false, reason: "note-numbers-not-supported" };
    }
    if (looksInternalOnly(note.value)) return { valid: false, reason: "internal-note-selected" };
  }

  return { valid: true, reason: "ok" };
}

export function buildCanonicalRoomListing(candidateValue) {
  const candidate = sanitizeRoomSummaryAiExtraction(candidateValue);
  if (!candidate) return "";

  const lines = [];
  if (candidate.address.value) lines.push(`Địa chỉ: ${candidate.address.value}`);

  const roomsWithAvailability = candidate.rooms.filter((room) => room.availability);
  const availabilityGroups = groupByExactValue(roomsWithAvailability, (room) => room.availability);
  for (const group of availabilityGroups) {
    const codes = group.items.map((room) => room.code).filter(Boolean);
    if (!codes.length) continue;
    lines.push(canonicalAvailabilityLine(group.value, codes));
  }
  if (!availabilityGroups.length && candidate.availability.value) {
    lines.push(`Trống: ${candidate.availability.value}`);
  }

  const roomsWithPrice = candidate.rooms.filter((room) => room.price);
  const priceGroups = groupByExactValue(roomsWithPrice, (room) => room.price);
  if (priceGroups.length) {
    lines.push("Giá:");
    for (const group of priceGroups) {
      const codes = group.items.map((room) => room.code).filter(Boolean);
      if (codes.length) lines.push(`${group.value} - ${codes.join(", ")}`);
    }
  } else if (candidate.price.value) {
    lines.push(`Giá: ${candidate.price.value}`);
  }

  if (candidate.roomType.value) lines.push(`Dạng phòng: ${candidate.roomType.value}`);
  if (candidate.elevator.value === "yes") lines.push("Thang: máy");
  else if (candidate.elevator.value === "no") lines.push("Thang: bộ");
  if (candidate.furniture.value) lines.push(`Nội thất: ${candidate.furniture.value}`);

  if (candidate.services.length) {
    lines.push("Dịch vụ:");
    for (const service of candidate.services) {
      lines.push(`${SERVICE_LABELS[service.key]}: ${service.value}`);
    }
  }

  if (candidate.notes.length) {
    lines.push("Lưu ý:");
    for (const note of candidate.notes) lines.push(`- ${note.value}`);
  }

  return lines.join("\n").trim();
}

function roomSummaryExtractionInstructions() {
  return `Bạn là bộ phân tích dữ liệu phòng trọ cho Joy. Đọc TOÀN BỘ tin nguồn và trích xuất dữ kiện ngay từ đầu; không chỉ sửa chính tả.

Trả về đúng JSON theo schema. Mỗi dữ kiện phải kèm 1-3 đoạn evidence NGUYÊN VĂN, ngắn nhất có thể, lấy trực tiếp từ tin nguồn. Nếu không đủ bằng chứng thì để value rỗng, hoặc elevator = "unknown".

Nhiệm vụ:
- address: nhận diện địa chỉ thực của căn/phòng dù nguồn không ghi nhãn "Địa chỉ". Chỉ chuẩn hóa khoảng trắng, dấu câu và viết hoa; không bổ sung địa danh không có trong nguồn.
- rooms + price: nhận diện từng mã phòng và mức giá tương ứng. Nếu một giá áp dụng cho nhiều phòng thì tạo một item cho từng phòng với cùng giá. GIỮ NGUYÊN cách ghi số tiền từ nguồn, ví dụ 4tr4 vẫn là 4tr4.
- availability: nhận diện ngày/mốc trống. Gắn availability vào từng room khi nguồn cho biết nhóm phòng khác ngày. Chuẩn hóa ưu tiên: "Vào luôn", "Đang trống", hoặc ngày D/M[/YYYY]. Không tự suy ngày.
- roomType: nhận diện Studio, 1N1K, duplex, CCMN, căn hộ... khi nguồn nêu rõ.
- elevator: yes chỉ khi nguồn nói có thang máy; no chỉ khi nguồn nói không có/thang bộ; nếu không đề cập thì unknown.
- furniture: hiểu và chuẩn hóa nội thất thay vì chép nguyên văn. Có thể mở rộng viết tắt rõ ràng (đh -> điều hòa, nl -> nóng lạnh) nếu ngữ cảnh chắc chắn. Nếu nguồn chỉ nói "full nội thất" thì chỉ ghi "Đầy đủ nội thất", KHÔNG tự bịa danh sách đồ.
- services: tách Điện, Nước, Mạng/Wi-Fi, Dịch vụ chung, Gửi xe, Tủ lạnh, Giặt sấy... thành đúng key; giữ nguyên mọi mức phí, điều kiện và đơn vị mơ hồ. Không tự đổi 35k/m thành /m³ nếu nguồn không nói.
- notes: CHỈ chọn lưu ý hữu ích cho khách thuê như cọc, hợp đồng, pet/thú cưng, số người, số xe, giờ giấc, không chung chủ, khách nước ngoài, điều kiện thuê, khoảng cách tiện ích có ích. Có thể viết gọn và sửa chính tả nhưng không đổi nghĩa.

BẮT BUỘC loại khỏi notes và mọi trường khách xem:
- hoa hồng/HH/commission;
- nguồn hàng, tên nguồn, mã nội bộ;
- số điện thoại, Zalo, liên hệ môi giới;
- hướng dẫn nghiệp vụ như "qua hẹn xem gọi trước" nếu chỉ là chỉ dẫn cho sale.

Ràng buộc tuyệt đối:
- Không sáng tác hoặc suy đoán dữ kiện.
- Không thay đổi số tiền, giá, mã phòng, ngày, số người, số xe, thời lượng, khoảng cách hoặc con số khác.
- Không lấy một mức giá của phòng này gán cho phòng khác nếu nguồn không hỗ trợ.
- Evidence phải thực sự xuất hiện trong source; không được viết lại evidence.
- Không thêm markdown, giải thích hay trường ngoài schema.`;
}

function sanitizeEvidencedValue(value, maximum) {
  return {
    value: cleanText(value?.value, maximum),
    evidence: sanitizeEvidence(value?.evidence),
  };
}

function sanitizeEvidence(value) {
  const items = Array.isArray(value) ? value : [];
  const result = [];
  for (const item of items.slice(0, MAX_EVIDENCE_ITEMS)) {
    const clean = cleanText(item, MAX_EVIDENCE_LENGTH);
    if (!clean) continue;
    if (!result.includes(clean)) result.push(clean);
  }
  return result;
}

function validateEvidencedValue(source, field, name) {
  if (!field?.value) return { valid: true, reason: "ok" };
  const evidenceValidation = validateEvidenceAgainstSource(source, field.evidence, true);
  if (!evidenceValidation.valid) return { valid: false, reason: `${name}-${evidenceValidation.reason}` };
  if (!numbersSupported(field.value, field.evidence.join("\n"))) {
    return { valid: false, reason: `${name}-numbers-not-supported` };
  }
  return { valid: true, reason: "ok" };
}

function validateEvidenceAgainstSource(source, evidence, required) {
  if (required && (!Array.isArray(evidence) || !evidence.length)) {
    return { valid: false, reason: "evidence-missing" };
  }
  const foldedSource = foldEvidence(source);
  for (const item of evidence || []) {
    if (!foldedSource.includes(foldEvidence(item))) {
      return { valid: false, reason: "evidence-not-in-source" };
    }
  }
  return { valid: true, reason: "ok" };
}

function validateElevator(source, elevator) {
  if (elevator.value === "unknown") return { valid: true, reason: "ok" };
  const evidenceValidation = validateEvidenceAgainstSource(source, elevator.evidence, true);
  if (!evidenceValidation.valid) return { valid: false, reason: `elevator-${evidenceValidation.reason}` };
  const text = foldText(elevator.evidence.join(" "));
  const mentionsElevator = /\bthang may\b|\btm\b|thang\s*:\s*may/u.test(text);
  const negative = /khong\s+(?:co\s+)?thang may|ko\s+(?:co\s+)?thang may|thang bo|khong\s+tm|ko\s+tm/u.test(text);
  if (elevator.value === "yes" && (!mentionsElevator || negative)) {
    return { valid: false, reason: "elevator-value-not-supported" };
  }
  if (elevator.value === "no" && !negative) {
    return { valid: false, reason: "elevator-value-not-supported" };
  }
  return { valid: true, reason: "ok" };
}

function addressLooksSupported(value, evidence) {
  const valueTokens = significantTokens(value);
  const evidenceTokens = new Set(significantTokens(evidence.join(" ")));
  if (!valueTokens.length) return true;
  return valueTokens.every((token) => evidenceTokens.has(token) || /^\d/u.test(token));
}

function roomTypeLooksSupported(value, evidence) {
  const normalizedValue = foldText(value);
  const normalizedEvidence = foldText(evidence.join(" "));
  const aliases = [
    ["studio", ["studio"]],
    ["1n1k", ["1n1k", "1 ngu 1 khach", "1 phong ngu"]],
    ["duplex", ["duplex", "gac xep"]],
    ["ccmn", ["ccmn", "chung cu mini"]],
    ["can ho", ["can ho"]],
    ["phong tro", ["phong tro"]],
  ];
  const match = aliases.find(([key]) => normalizedValue.includes(key));
  if (!match) return significantTokens(value).some((token) => normalizedEvidence.includes(token));
  return match[1].some((alias) => normalizedEvidence.includes(alias));
}

function roomCodeSupported(code, evidence) {
  const normalizedCode = foldText(code).replace(/^p(?=\d)/u, "");
  const candidates = String(evidence || "").match(/\bP?[A-Za-z]*\d[A-Za-z0-9./-]*\b/giu) || [];
  return candidates.some((candidate) => foldText(candidate).replace(/^p(?=\d)/u, "") === normalizedCode);
}

function serviceKeySupported(key, evidence) {
  if (key === "other") return true;
  const text = foldText(evidence);
  return (SERVICE_EVIDENCE_ALIASES[key] || []).some((alias) => text.includes(alias));
}

function numbersSupported(value, evidence) {
  const candidate = numericTokens(value);
  if (!candidate.length) return true;
  const source = new Set(numericTokens(evidence));
  return candidate.every((token) => source.has(token));
}

function numericTokens(value) {
  return [...String(value || "").matchAll(/\d+(?:[.,]\d+)?/gu)]
    .map((match) => String(match[0]).replace(",", ".").replace(/^0+(?=\d)/u, ""));
}

function looksInternalOnly(value) {
  const text = foldText(value);
  return /hoa hong|commission|\bhh\b|nguon hang|\bnguon\b|\bsource\b|\bzalo\b|\bsdt\b|\bphone\b|lien he moi gioi/u.test(text);
}

function canonicalAvailabilityLine(value, codes) {
  const clean = cleanText(value, 160).replace(/\s*\/\s*/g, "/");
  const date = clean.match(/(?:^|\b)(?:tu\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?:\b|$)/iu);
  if (date) return `${date[1]} trống: ${codes.join(", ")}`;
  const normalized = foldText(clean);
  if (/vao luon|o ngay|vao o ngay/u.test(normalized)) return `Vào luôn: ${codes.join(", ")}`;
  if (/dang trong|san phong/u.test(normalized)) return `Đang trống: ${codes.join(", ")}`;
  return `Trống: ${clean} - ${codes.join(", ")}`;
}

function groupByExactValue(items, valueFor) {
  const groups = new Map();
  for (const item of items) {
    const value = cleanText(valueFor(item), 300);
    const key = foldText(value);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { value, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

function sanitizeRoomCode(value) {
  return cleanText(value, 80)
    .replace(/^(?:phòng|phong)\s*/iu, "")
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9./-]/g, "")
    .slice(0, 40);
}

function normalizeServiceKey(value) {
  const raw = cleanText(value, 80).toLocaleLowerCase("vi");
  if (Object.hasOwn(SERVICE_LABELS, raw)) return raw;
  return "";
}

function significantTokens(value) {
  const stop = new Set(["so", "ngo", "ngach", "duong", "pho", "quan", "phuong", "huyen", "thanh", "pho", "dia", "chi"]);
  return foldText(value)
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 2 && !stop.has(token));
}

function foldEvidence(value) {
  return foldText(value).replace(/[^a-z0-9]+/gu, " ").replace(/\s+/g, " ").trim();
}

function foldText(value) {
  return String(value || "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAiObject(result) {
  const raw = result?.response ?? result?.result ?? result?.text ?? result;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (Object.hasOwn(raw, "rooms") && Object.hasOwn(raw, "services")) return raw;
    const nested = raw.response ?? raw.result ?? raw.text;
    if (nested && typeof nested === "object") return nested;
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
