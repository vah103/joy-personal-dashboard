import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

export const SALE_ROOM_SUMMARY_AI_PATH = "/api/sales/room-summary/address";
export const DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const MAX_SOURCE_LENGTH = 12000;
const MAX_ADDRESS_LENGTH = 320;

const ADDRESS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    address: { type: "string" },
  },
  required: ["address"],
};

export function isSaleRoomSummaryAiRoute(pathname) {
  return pathname === SALE_ROOM_SUMMARY_AI_PATH;
}

export async function handleSaleRoomSummaryAiRequest(request, env) {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = await readJson(request);
  const source = normalizeRoomAddressSource(body?.source);
  if (!source) return json({ error: "ROOM_ADDRESS_SOURCE_INVALID" }, 400);

  if (!env?.AI?.run) return json({ error: "AI_UNAVAILABLE" }, 503);

  const model = cleanText(env.SALE_ROOM_SUMMARY_AI_MODEL, 160)
    || DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL;

  try {
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: roomAddressInstructions() },
        { role: "user", content: source },
      ],
      response_format: {
        type: "json_schema",
        json_schema: ADDRESS_SCHEMA,
      },
      temperature: 0,
      max_tokens: 160,
    });

    const candidate = normalizeDetectedAddress(extractAiObject(result)?.address);
    if (!candidate) {
      return json({ ok: true, found: false, address: "", model });
    }

    if (!addressIsGroundedInSource(source, candidate)) {
      console.warn("Joy Sale room-address AI rejected an ungrounded address", candidate);
      return json({ ok: true, found: false, address: "", reason: "ungrounded-address", model });
    }

    return json({
      ok: true,
      found: true,
      provider: "workers-ai",
      model,
      address: candidate,
    });
  } catch (error) {
    console.warn("Joy Sale room-address AI unavailable", error?.message || error);
    return json({ error: "AI_FAILED" }, 503);
  }
}

export function normalizeRoomAddressSource(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim()
    .slice(0, MAX_SOURCE_LENGTH);
}

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
  const source = normalizeComparable(sourceValue);
  const address = normalizeComparable(addressValue);
  if (!source || !address) return false;
  return source.includes(address);
}

function roomAddressInstructions() {
  return `Bạn là bộ trích xuất địa chỉ cho tin phòng trọ/căn hộ bằng tiếng Việt.
Nhiệm vụ duy nhất: tìm địa chỉ của căn/phòng đang được đăng trong nội dung người dùng gửi.

Trả về đúng JSON theo schema với duy nhất trường address.

Quy tắc:
- Chỉ lấy địa chỉ có thật trong nội dung nguồn; tuyệt đối không suy đoán hoặc bổ sung địa danh còn thiếu.
- Không tự thêm Hà Nội, quận, phường, ngõ, số nhà hoặc bất kỳ chi tiết nào nếu nguồn không viết.
- Có thể bỏ nhãn như "Địa chỉ:", emoji và ký hiệu trang trí.
- Giữ nguyên nội dung địa chỉ, chỉ được dọn khoảng trắng và dấu câu thừa.
- Nếu địa chỉ nằm trên nhiều dòng liên tiếp, có thể ghép các dòng thuộc cùng một địa chỉ, ví dụ dòng sau là "Quận: Hoàng Mai".
- Không lấy số phòng, giá phòng, ngày trống, số điện thoại, hoa hồng, mã nguồn hoặc địa chỉ của một địa điểm chỉ được nhắc trong ghi chú làm địa chỉ căn phòng.
- Nếu có nhiều địa chỉ và không xác định chắc địa chỉ của căn/phòng đang đăng, trả address là chuỗi rỗng.
- Nếu không tìm thấy địa chỉ, trả address là chuỗi rỗng.
- Không thêm tiền tố "Địa chỉ:" vào giá trị address.`;
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
    if (Object.hasOwn(raw, "address")) return raw;
    const nested = raw.response ?? raw.result ?? raw.text;
    if (nested && typeof nested === "object" && Object.hasOwn(nested, "address")) return nested;
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
