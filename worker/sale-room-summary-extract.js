import { DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL } from "./sale-room-summary-ai.js";
import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

export const SALE_ROOM_SUMMARY_AI_EXTRACT_PATH = "/api/sales/room-summary/analyze";

const MAX_SOURCE_LENGTH = 12_000;
const MAX_EVIDENCE_ITEMS = 3;
const MAX_EVIDENCE_LENGTH = 520;
const MAX_ROOMS = 40;
const MAX_FURNITURE_ITEMS = 24;
const MAX_SERVICES = 12;
const MAX_SERVICE_INCLUDES = 16;
const MAX_NOTES = 12;

const SERVICE_KEYS = Object.freeze([
  "electricity",
  "water",
  "internet",
  "common",
  "parking",
  "fridge",
  "laundry",
  "other",
]);

const SERVICE_EVIDENCE_ALIASES = Object.freeze({
  electricity: ["dien"],
  water: ["nuoc"],
  internet: ["wifi", "wi-fi", "internet", "mang"],
  common: ["dich vu chung", "phi dich vu", "dvc", "ve sinh", "vsinh"],
  parking: ["gui xe", "de xe", "parking", "xe"],
  fridge: ["tu lanh", "fridge"],
  laundry: ["giat say", "may giat", "laundry"],
  other: [],
});

const FURNITURE_ALIASES = Object.freeze({
  "dieu hoa": ["dieu hoa", "dh", "may lanh", "aircon", "air conditioner"],
  "nong lanh": ["nong lanh", "binh nong lanh"],
  "giuong": ["giuong"],
  "tu": ["tu", "tu quan ao"],
  "bep": ["bep", "bep tu", "bep dien"],
  "tu lanh": ["tu lanh"],
  "may giat": ["may giat"],
  "sofa": ["sofa", "ghe sofa"],
  "ban": ["ban", "ban lam viec", "ban tra"],
  "dem": ["dem"],
  "day du noi that": ["full noi that", "full do", "du do", "day du noi that"],
});

const EVIDENCED_STRING_SCHEMA = Object.freeze({
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
    address: EVIDENCED_STRING_SCHEMA,
    area: EVIDENCED_STRING_SCHEMA,
    floor: EVIDENCED_STRING_SCHEMA,
    price: EVIDENCED_STRING_SCHEMA,
    availability: EVIDENCED_STRING_SCHEMA,
    roomType: EVIDENCED_STRING_SCHEMA,
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
    furniture: {
      type: "array",
      maxItems: MAX_FURNITURE_ITEMS,
      items: EVIDENCED_STRING_SCHEMA,
    },
    services: {
      type: "array",
      maxItems: MAX_SERVICES,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", enum: SERVICE_KEYS },
          value: { type: "string" },
          includes: {
            type: "array",
            maxItems: MAX_SERVICE_INCLUDES,
            items: { type: "string" },
          },
          evidence: {
            type: "array",
            maxItems: MAX_EVIDENCE_ITEMS,
            items: { type: "string" },
          },
        },
        required: ["key", "value", "includes", "evidence"],
      },
    },
    payment: EVIDENCED_STRING_SCHEMA,
    contract: EVIDENCED_STRING_SCHEMA,
    notes: {
      type: "array",
      maxItems: MAX_NOTES,
      items: EVIDENCED_STRING_SCHEMA,
    },
  },
  required: [
    "address",
    "area",
    "floor",
    "price",
    "availability",
    "roomType",
    "elevator",
    "rooms",
    "furniture",
    "services",
    "payment",
    "contract",
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
      max_tokens: 2200,
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

    return json({
      ok: true,
      applied: true,
      provider: "workers-ai",
      model,
      extraction,
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
      price: cleanText(room?.price, 160),
      availability: cleanText(room?.availability, 180),
      evidence: sanitizeEvidence(room?.evidence),
    }))
    .filter((room) => room.code || room.price || room.availability);

  const furniture = (Array.isArray(value.furniture) ? value.furniture : [])
    .slice(0, MAX_FURNITURE_ITEMS)
    .map((item) => sanitizeEvidencedValue(item, 180))
    .filter((item) => item.value);

  const services = (Array.isArray(value.services) ? value.services : [])
    .slice(0, MAX_SERVICES)
    .map((service) => ({
      key: normalizeServiceKey(service?.key),
      value: cleanText(service?.value, 500),
      includes: [...new Set((Array.isArray(service?.includes) ? service.includes : [])
        .slice(0, MAX_SERVICE_INCLUDES)
        .map((item) => cleanText(item, 140))
        .filter(Boolean))],
      evidence: sanitizeEvidence(service?.evidence),
    }))
    .filter((service) => service.key && service.value);

  const notes = (Array.isArray(value.notes) ? value.notes : [])
    .slice(0, MAX_NOTES)
    .map((item) => sanitizeEvidencedValue(item, 500))
    .filter((item) => item.value);

  return {
    address: sanitizeEvidencedValue(value.address, 500),
    area: sanitizeEvidencedValue(value.area, 120),
    floor: sanitizeEvidencedValue(value.floor, 120),
    price: sanitizeEvidencedValue(value.price, 220),
    availability: sanitizeEvidencedValue(value.availability, 220),
    roomType: sanitizeEvidencedValue(value.roomType, 220),
    elevator: {
      value: elevatorValue,
      evidence: sanitizeEvidence(value.elevator?.evidence),
    },
    rooms,
    furniture,
    services,
    payment: sanitizeEvidencedValue(value.payment, 300),
    contract: sanitizeEvidencedValue(value.contract, 260),
    notes,
  };
}

export function validateRoomSummaryAiExtraction(sourceValue, candidateValue) {
  const source = normalizeRoomListingSource(sourceValue);
  const candidate = sanitizeRoomSummaryAiExtraction(candidateValue);
  if (!source || !candidate) return { valid: false, reason: "invalid-shape" };

  const fieldChecks = [
    ["address", candidate.address, addressLooksSupported],
    ["area", candidate.area, areaLooksSupported],
    ["floor", candidate.floor, floorLooksSupported],
    ["price", candidate.price, priceLooksSupported],
    ["availability", candidate.availability, availabilityLooksSupported],
    ["room-type", candidate.roomType, roomTypeLooksSupported],
    ["payment", candidate.payment, paymentLooksSupported],
    ["contract", candidate.contract, contractLooksSupported],
  ];

  for (const [name, field, semanticCheck] of fieldChecks) {
    const validation = validateEvidencedValue(source, field, name);
    if (!validation.valid) return validation;
    if (field.value && !semanticCheck(field.value, field.evidence)) {
      return { valid: false, reason: `${name}-not-supported` };
    }
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
    if (room.availability && !availabilityLooksSupported(room.availability, room.evidence)) {
      return { valid: false, reason: "room-availability-not-supported" };
    }

    const key = foldText(room.code);
    if (roomKeys.has(key)) return { valid: false, reason: "duplicate-room" };
    roomKeys.add(key);
  }

  for (const item of candidate.furniture) {
    const evidenceValidation = validateEvidenceAgainstSource(source, item.evidence, true);
    if (!evidenceValidation.valid) return { valid: false, reason: `furniture-${evidenceValidation.reason}` };
    if (!furnitureItemSupported(item.value, item.evidence)) {
      return { valid: false, reason: "furniture-item-not-supported" };
    }
  }

  for (const service of candidate.services) {
    const evidenceValidation = validateEvidenceAgainstSource(source, service.evidence, true);
    if (!evidenceValidation.valid) return { valid: false, reason: `service-${evidenceValidation.reason}` };
    const evidenceText = service.evidence.join("\n");
    if (!numbersSupported(service.value, evidenceText)) return { valid: false, reason: "service-numbers-not-supported" };
    if (!serviceKeySupported(service.key, evidenceText)) return { valid: false, reason: "service-key-not-supported" };
    if (containsFreeClaim(service.value) && !containsExplicitFreeClaim(evidenceText)) {
      return { valid: false, reason: "service-free-not-supported" };
    }
    for (const included of service.includes) {
      if (!includedItemSupported(included, evidenceText)) {
        return { valid: false, reason: "service-include-not-supported" };
      }
    }
  }

  const commonIncluded = candidate.services
    .filter((service) => service.key === "common")
    .flatMap((service) => service.includes);
  for (const service of candidate.services) {
    if (service.key === "common" || service.key === "other") continue;
    if (!includedConceptMatches(service.key, commonIncluded)) continue;
    if (!serviceHasIndependentChargeEvidence(service.key, service.evidence.join(" "))) {
      return { valid: false, reason: "included-service-split" };
    }
  }

  for (const note of candidate.notes) {
    const evidenceValidation = validateEvidenceAgainstSource(source, note.evidence, true);
    if (!evidenceValidation.valid) return { valid: false, reason: `note-${evidenceValidation.reason}` };
    if (!numbersSupported(note.value, note.evidence.join("\n"))) {
      return { valid: false, reason: "note-numbers-not-supported" };
    }
    if (looksInternalOnly(`${note.value}\n${note.evidence.join("\n")}`)) {
      return { valid: false, reason: "internal-note-selected" };
    }
  }

  return { valid: true, reason: "ok" };
}

function roomSummaryExtractionInstructions() {
  return `Bạn là bộ phân tích ngữ nghĩa tin phòng cho Joy. Hãy hiểu toàn bộ tin nguồn rồi phân loại dữ kiện trực tiếp vào JSON; KHÔNG copy một đoạn dài vào field gần nhất và KHÔNG chỉ sửa chính tả.

Mỗi dữ kiện phải kèm 1-3 đoạn evidence NGUYÊN VĂN, ngắn nhất có thể, lấy trực tiếp từ tin nguồn. Nếu nguồn không nói rõ thì để value rỗng; riêng elevator dùng "unknown". Không được suy đoán từ tiêu đề "cho thuê" rằng phòng đang trống.

Phân loại bắt buộc:
- address: chỉ địa chỉ căn/phòng.
- area: diện tích, chuẩn hóa ví dụ 22m2 -> 22m².
- floor: tầng của phòng, ví dụ "Phòng tầng 4" -> "Tầng 4".
- price: CHỈ giá thuê. Ví dụ "Giá thuê: 3tr" -> "3 triệu/tháng". Tuyệt đối không kéo "thanh toán", "cọc", "hợp đồng" vào price.
- availability: chỉ khi nguồn nói rõ đang trống, vào luôn, sẵn phòng hoặc ngày trống. Không có bằng chứng -> value rỗng.
- roomType: loại/dạng phòng. "vệ sinh khép kín" có thể chuẩn hóa thành "Phòng khép kín" nếu ngữ cảnh rõ.
- elevator: "thang máy" -> yes; "thang bộ", "không thang máy" -> no; không nói -> unknown.
- rooms: chỉ khi có mã/số phòng. Mỗi phòng phải gắn đúng giá và đúng ngày trống của chính nó. Giữ logic nhóm phòng có cùng giá/ngày.
- furniture: trả về DANH SÁCH từng món đã hiểu, không copy nguyên câu. Trong ngữ cảnh nội thất, "ĐH" = "Điều hòa", KHÔNG phải "Đệm". Có thể chuẩn hóa viết tắt rõ nghĩa; không bịa món không có trong source.
- services: phân loại Điện/Nước/Mạng/Dịch vụ chung/Gửi xe/Tủ lạnh/Giặt sấy/Khác. value là mức phí/điều kiện của đúng dịch vụ đó. includes là các hạng mục nằm trong phí đó.
- QUY TẮC CỰC KỲ QUAN TRỌNG: nội dung nằm trong ngoặc của một phí chung, ví dụ "dv chung 180k/ng (vệ sinh, rác, mạng, điện chung, máy giặt)", phải nằm trong common.includes. KHÔNG tách Mạng hay Máy giặt thành dịch vụ riêng nếu source không có mức phí riêng.
- "được bao gồm" KHÔNG đồng nghĩa "miễn phí". Chỉ dùng "miễn phí/free" khi source nói rõ miễn phí/free/0đ.
- payment: điều khoản thanh toán/cọc. Ví dụ "1 cọc 1" -> "Thanh toán 1 tháng, cọc 1 tháng" khi ngữ cảnh thanh toán rõ.
- contract: thời hạn hợp đồng, ví dụ "HĐ 12 tháng" -> "Hợp đồng 12 tháng".
- notes: chỉ chọn thông tin khách thuê thực sự cần biết: giờ giấc, pet, số người, xe, ô tô đỗ cửa, vị trí gần trường, không chung chủ, PCCC... Không lặp lại address/price/payment/contract/furniture/services.

Loại bỏ hoàn toàn khỏi customer view: hoa hồng/HH/commission, tên hoặc số điện thoại liên hệ, Zalo, nguồn hàng/mã nội bộ, @All, lời nhắc môi giới. Không mở rộng viết tắt mơ hồ nếu không chắc nghĩa.

Ví dụ quan hệ đúng:
Nguồn: "Nội thất: ĐH, Nóng lạnh, giường tủ" -> furniture = Điều hòa, Nóng lạnh, Giường, Tủ.
Nguồn: "dv chung: 180k/ng (vệ sinh, rác, mạng, điện chung, máy giặt...)" -> service common value 180k/người + includes; KHÔNG tạo internet/laundry miễn phí.
Nguồn: "Giá thuê: 3tr - Thanh toán: 1 cọc 1" -> price = 3 triệu/tháng; payment = Thanh toán 1 tháng, cọc 1 tháng.

JSON phải đúng schema và không thêm field khác.`;
}

function validateEvidencedValue(source, field, name) {
  if (!field?.value) {
    if ((field?.evidence || []).length) return { valid: false, reason: `${name}-value-missing` };
    return { valid: true, reason: "ok" };
  }
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
    if (!item || !foldedSource.includes(foldEvidence(item))) {
      return { valid: false, reason: "evidence-not-in-source" };
    }
  }
  return { valid: true, reason: "ok" };
}

function addressLooksSupported(value, evidence) {
  const valueTokens = significantTokens(value);
  const evidenceTokens = new Set(significantTokens(evidence.join(" ")));
  if (!valueTokens.length) return true;
  return valueTokens.every((token) => evidenceTokens.has(token) || /^\d/u.test(token));
}

function areaLooksSupported(_value, evidence) {
  const text = foldText(evidence.join(" "));
  return /\b(?:dien tich|dt|s phong|m2|m²)\b/u.test(text) || /\d+\s*m\s*2/u.test(text);
}

function floorLooksSupported(_value, evidence) {
  return /\b(?:tang|lau)\b/u.test(foldText(evidence.join(" ")));
}

function priceLooksSupported(_value, evidence) {
  const text = foldText(evidence.join(" "));
  return /\b(?:gia|thue)\b/u.test(text) || /\d+(?:[.,]\d+)?\s*(?:tr|trieu|k|nghin|vnd|d)\b/u.test(text);
}

function availabilityLooksSupported(_value, evidence) {
  const text = foldText(evidence.join(" "));
  return /\b(?:trong|vao luon|o ngay|san phong|con phong|phong trong|tu ngay|dau thang|cuoi thang)\b/u.test(text)
    || /\b\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?\b/u.test(text);
}

function roomTypeLooksSupported(value, evidence) {
  const normalizedValue = foldText(value);
  const normalizedEvidence = foldText(evidence.join(" "));
  const aliases = [
    ["studio", ["studio"]],
    ["1n1k", ["1n1k", "1 ngu 1 khach", "1 phong ngu"]],
    ["duplex", ["duplex", "gac xep"]],
    ["gac xep", ["gac xep", "duplex"]],
    ["ccmn", ["ccmn", "chung cu mini"]],
    ["can ho", ["can ho"]],
    ["phong tro", ["phong tro"]],
    ["khep kin", ["khep kin", "ve sinh khep kin", "wc khep kin"]],
  ];
  const match = aliases.find(([key]) => normalizedValue.includes(key));
  if (!match) return significantTokens(value).some((token) => normalizedEvidence.includes(token));
  return match[1].some((alias) => normalizedEvidence.includes(alias));
}

function paymentLooksSupported(_value, evidence) {
  return /\b(?:thanh toan|coc|dat coc|dong)\b/u.test(foldText(evidence.join(" ")));
}

function contractLooksSupported(_value, evidence) {
  return /\b(?:hop dong|hd)\b/u.test(foldText(evidence.join(" ")));
}

function validateElevator(source, elevator) {
  if (elevator.value === "unknown") {
    if ((elevator.evidence || []).length) return { valid: false, reason: "elevator-unknown-with-evidence" };
    return { valid: true, reason: "ok" };
  }
  const evidenceValidation = validateEvidenceAgainstSource(source, elevator.evidence, true);
  if (!evidenceValidation.valid) return { valid: false, reason: `elevator-${evidenceValidation.reason}` };
  const text = foldText(elevator.evidence.join(" "));
  const positive = /\bthang may\b|\btm\b|thang\s*:\s*may/u.test(text);
  const negative = /khong\s+(?:co\s+)?thang may|ko\s+(?:co\s+)?thang may|\bthang bo\b|\bcau thang bo\b|khong\s+tm|ko\s+tm/u.test(text);
  if (elevator.value === "yes" && (!positive || negative)) {
    return { valid: false, reason: "elevator-value-not-supported" };
  }
  if (elevator.value === "no" && !negative) {
    return { valid: false, reason: "elevator-value-not-supported" };
  }
  return { valid: true, reason: "ok" };
}

function roomCodeSupported(code, evidence) {
  const normalizedCode = foldText(code).replace(/^p(?=\d)/u, "");
  const candidates = String(evidence || "").match(/\bP?[A-Za-z]*\d[A-Za-z0-9./-]*\b/giu) || [];
  return candidates.some((candidate) => foldText(candidate).replace(/^p(?=\d)/u, "") === normalizedCode);
}

function furnitureItemSupported(value, evidence) {
  const item = foldText(value);
  const text = foldText(evidence.join(" "));
  if (!item) return false;
  if (text.includes(item)) return true;
  const aliases = FURNITURE_ALIASES[item] || [];
  return aliases.some((alias) => new RegExp(`(?:^|[^a-z0-9])${escapeRegex(alias)}(?:$|[^a-z0-9])`, "u").test(text));
}

function serviceKeySupported(key, evidence) {
  if (key === "other") return true;
  const text = foldText(evidence);
  return (SERVICE_EVIDENCE_ALIASES[key] || []).some((alias) => text.includes(alias));
}

function includedItemSupported(value, evidence) {
  const item = foldText(value);
  const text = foldText(evidence);
  if (!item) return false;
  if (text.includes(item)) return true;
  return Object.values(SERVICE_EVIDENCE_ALIASES).flat().some((alias) => item.includes(alias) && text.includes(alias));
}

function includedConceptMatches(key, includedItems) {
  const aliases = SERVICE_EVIDENCE_ALIASES[key] || [];
  return includedItems.some((item) => {
    const normalized = foldText(item);
    return aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized));
  });
}

function serviceHasIndependentChargeEvidence(key, evidence) {
  const text = foldText(evidence);
  const aliases = SERVICE_EVIDENCE_ALIASES[key] || [];
  const amount = String.raw`(?:free|mien phi|0\s*(?:d|k|vnd)?|\d+(?:[.,]\d+)?\s*(?:k|tr|trieu|nghin|vnd|d))`;
  return aliases.some((alias) => {
    const escaped = escapeRegex(alias);
    return new RegExp(`(?:^|[^a-z0-9])${escaped}[^a-z0-9]{0,8}${amount}`, "u").test(text)
      || new RegExp(`${amount}[^a-z0-9]{0,8}${escaped}(?:$|[^a-z0-9])`, "u").test(text);
  });
}

function containsFreeClaim(value) {
  return /\b(?:free|mien phi|0\s*(?:d|k|vnd))\b/u.test(foldText(value));
}

function containsExplicitFreeClaim(value) {
  return containsFreeClaim(value);
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
  return /hoa hong|commission|\bhh\b|nguon hang|\bnguon\b|\bsource\b|\bzalo\b|\bsdt\b|\bphone\b|\blh\b|lien he|@all/u.test(text)
    || /(?:^|\D)(?:\+?84|0)(?:[ .-]?\d){8,10}(?!\d)/u.test(String(value || ""));
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
  return SERVICE_KEYS.includes(raw) ? raw : "";
}

function sanitizeEvidencedValue(value, maximum) {
  return {
    value: cleanText(value?.value, maximum),
    evidence: sanitizeEvidence(value?.evidence),
  };
}

function sanitizeEvidence(value) {
  const seen = new Set();
  const result = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const item = cleanText(raw, MAX_EVIDENCE_LENGTH);
    const key = foldEvidence(item);
    if (!item || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= MAX_EVIDENCE_ITEMS) break;
  }
  return result;
}

function significantTokens(value) {
  const stop = new Set(["so", "ngo", "ngach", "duong", "pho", "quan", "phuong", "huyen", "thanh", "dia", "chi"]);
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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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