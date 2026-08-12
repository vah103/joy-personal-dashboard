import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

export const SALE_ROOM_SUMMARY_AI_PATH = "/api/sales/room-summary/polish";
export const DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const MAX_FURNITURE_LENGTH = 1200;
const MAX_SERVICE_VALUE_LENGTH = 900;
const MAX_NOTE_LENGTH = 900;
const MAX_SERVICES = 12;
const MAX_NOTES = 12;

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

const POLISH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    furniture: { type: "string" },
    services: {
      type: "array",
      maxItems: MAX_SERVICES,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", enum: Object.keys(SERVICE_LABELS) },
          value: { type: "string" },
        },
        required: ["key", "value"],
      },
    },
    notes: {
      type: "array",
      maxItems: MAX_NOTES,
      items: { type: "string" },
    },
  },
  required: ["furniture", "services", "notes"],
};

export async function handleSaleRoomSummaryAiRequest(request, env) {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = await readJson(request);
  const source = normalizeRoomSummaryPolishInput(body?.summary);
  if (!source) return json({ error: "ROOM_SUMMARY_POLISH_INPUT_INVALID" }, 400);

  if (!env?.AI?.run) {
    return json({ ok: true, applied: false, reason: "ai-unavailable" });
  }

  const model = cleanText(env.SALE_ROOM_SUMMARY_AI_MODEL, 160)
    || DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL;

  try {
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: roomSummaryPolishInstructions() },
        { role: "user", content: JSON.stringify(source) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: POLISH_SCHEMA,
      },
      temperature: 0,
      max_tokens: 900,
    });

    const candidate = sanitizeAiPolish(extractAiObject(result));
    if (!candidate) {
      return json({ ok: true, applied: false, reason: "invalid-ai-output", model });
    }

    const validation = validateRoomSummaryAiPolish(source, candidate);
    if (!validation.valid) {
      console.warn("Joy Sale room-summary AI polish rejected", validation.reason);
      return json({ ok: true, applied: false, reason: validation.reason, model });
    }

    return json({
      ok: true,
      applied: true,
      provider: "workers-ai",
      model,
      polish: candidate,
    });
  } catch (error) {
    console.warn("Joy Sale room-summary AI polish unavailable", error?.message || error);
    return json({ ok: true, applied: false, reason: "ai-failed", model });
  }
}

export function normalizeRoomSummaryPolishInput(value) {
  if (!value || typeof value !== "object") return null;

  const furniture = cleanText(value.furniture, MAX_FURNITURE_LENGTH);
  const services = normalizeServices(value.services);
  const notes = normalizeNotes(value.notes);
  if (!furniture && !services.length && !notes.length) return null;

  return { furniture, services, notes };
}

export function validateRoomSummaryAiPolish(sourceValue, candidateValue) {
  const source = normalizeRoomSummaryPolishInput(sourceValue);
  const candidate = sanitizeAiPolish(candidateValue);
  if (!source || !candidate) return { valid: false, reason: "invalid-shape" };

  const sourceText = serializePolishable(source);
  const candidateText = serializePolishable(candidate);

  const sourceMoney = tokenSet(sourceText, MONEY_TOKEN_PATTERN, normalizeMoneyToken);
  const candidateMoney = tokenSet(candidateText, MONEY_TOKEN_PATTERN, normalizeMoneyToken);
  if (!sameSets(sourceMoney, candidateMoney)) {
    return { valid: false, reason: "money-facts-changed" };
  }

  const sourceNumbers = meaningfulNumberSet(sourceText);
  const candidateNumbers = meaningfulNumberSet(candidateText);
  if (!sameSets(sourceNumbers, candidateNumbers)) {
    return { valid: false, reason: "numeric-facts-changed" };
  }

  return { valid: true, reason: "ok" };
}

function roomSummaryPolishInstructions() {
  return `Bạn là bước biên tập cuối cho một bản tóm tắt phòng trọ bằng tiếng Việt.
Chỉ sửa câu chữ trong ba phần được cung cấp: furniture, services, notes. Trả về đúng JSON theo schema.

Mục tiêu:
- Sửa chính tả, viết hoa, khoảng trắng và dấu câu.
- Mở rộng viết tắt rõ ràng: "Dv chung" -> "Dịch vụ chung", "Wifi/Wiffi" -> "Wi-Fi", "30p" -> "30 phút".
- Nếu một giá trị dịch vụ đang dính nhiều loại phí, hãy tách đúng sang các key tương ứng.
- Có thể đổi từ tiếng Anh phổ biến sang tiếng Việt tự nhiên, ví dụ "free" -> "miễn phí".
- Bỏ dấu ngoặc kép thừa và gộp/bỏ ghi chú trùng nghĩa.
- Viết câu ngắn, rõ, phù hợp để gửi khách; không thêm markdown.

Ràng buộc tuyệt đối:
- Không được sáng tác hoặc suy đoán thông tin mới.
- Giữ nguyên mọi số tiền, mức phí, số người, số xe, khoảng cách, thời lượng và con số khác.
- Không tự đoán đơn vị bị mơ hồ. Ví dụ "Nước 35k/m" phải giữ là "35k/m", KHÔNG đổi thành m³ hay /khối nếu nguồn không nói rõ.
- Không thay đổi ý nghĩa điều kiện thuê.
- Không thêm địa chỉ, giá phòng, mã phòng hoặc ngày trống; các trường đó không thuộc nhiệm vụ này.
- Nếu không chắc cách sửa một cụm, giữ nguyên nội dung và chỉ sửa khoảng trắng/dấu câu.

Service key hợp lệ:
- electricity = Điện
- water = Nước
- internet = Mạng
- common = Dịch vụ chung
- parking = Gửi xe
- fridge = Tủ lạnh
- laundry = Giặt sấy
- other = Khác`;
}

function normalizeServices(value) {
  const items = Array.isArray(value) ? value : [];
  const result = [];
  for (const item of items.slice(0, MAX_SERVICES)) {
    if (!item || typeof item !== "object") continue;
    const key = normalizeServiceKey(item.key || item.label);
    const serviceValue = cleanText(item.value, MAX_SERVICE_VALUE_LENGTH);
    if (!key || !serviceValue) continue;
    result.push({ key, label: SERVICE_LABELS[key], value: serviceValue });
  }
  return result;
}

function normalizeNotes(value) {
  const items = Array.isArray(value) ? value : [];
  const result = [];
  for (const item of items.slice(0, MAX_NOTES)) {
    const note = cleanText(item, MAX_NOTE_LENGTH).replace(/^["'“”]+|["'“”]+$/g, "").trim();
    if (!note) continue;
    const key = note.toLocaleLowerCase("vi");
    if (!result.some((existing) => existing.toLocaleLowerCase("vi") === key)) result.push(note);
  }
  return result;
}

function sanitizeAiPolish(value) {
  if (!value || typeof value !== "object") return null;
  const furniture = cleanText(value.furniture, MAX_FURNITURE_LENGTH);
  const services = normalizeServices(value.services);
  const notes = normalizeNotes(value.notes);
  return { furniture, services, notes };
}

function normalizeServiceKey(value) {
  const raw = cleanText(value, 80).toLocaleLowerCase("vi");
  if (Object.hasOwn(SERVICE_LABELS, raw)) return raw;
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  const aliases = {
    dien: "electricity",
    nuoc: "water",
    mang: "internet",
    internet: "internet",
    wifi: "internet",
    "wi-fi": "internet",
    "dich vu chung": "common",
    "phi dich vu": "common",
    "gui xe": "parking",
    xe: "parking",
    "tu lanh": "fridge",
    "giat say": "laundry",
    khac: "other",
  };
  return aliases[normalized] || "";
}

const MONEY_TOKEN_PATTERN = /\b\d+(?:[.,]\d+)?(?:tr\d*|k\d*|nghìn|nghin|triệu|trieu|vnđ|vnd|đ)\b/giu;
const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/gu;

function meaningfulNumberSet(value) {
  const tokens = new Set();
  for (const match of String(value || "").matchAll(NUMBER_PATTERN)) {
    const normalized = String(match[0]).replace(",", ".").replace(/^0+(?=\d)/, "");
    if (!normalized || normalized === "1") continue;
    tokens.add(normalized);
  }
  return tokens;
}

function normalizeMoneyToken(value) {
  return String(value || "")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/nghìn|nghin/g, "k")
    .replace(/triệu|trieu/g, "tr");
}

function tokenSet(value, pattern, normalize) {
  return new Set([...String(value || "").matchAll(pattern)].map((match) => normalize(match[0])));
}

function sameSets(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function serializePolishable(value) {
  return [
    value.furniture,
    ...(value.services || []).map((service) => `${service.key}:${service.value}`),
    ...(value.notes || []),
  ].join("\n");
}

function extractAiObject(result) {
  const raw = result?.response ?? result?.result ?? result?.text ?? result;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (Object.hasOwn(raw, "furniture") && Array.isArray(raw.services) && Array.isArray(raw.notes)) return raw;
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
