import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";
import {
  MAX_ITEMS, MAX_ROOMS, MAX_SERVICE_ITEMS,
  addressIsGroundedInSource, clean, elevatorStatusInSource,
  extractSourceAddress, extractSourceFurniture, extractSourceRoomType, fold,
  normalizeDetectedAddress, normalizeDetectedFurniture, normalizeRoomSummarySource,
} from "./sale-room-summary-foundation.js";
import { extractSourceRoomMentions, normalizeDetectedRooms } from "./sale-room-summary-rooms.js";
import { reconcileParenthesizedRoomAvailability } from "./sale-room-summary-room-availability.js";
import {
  extractSourceDynamicServiceItems, extractSourceUtilityServices,
  normalizeDetectedServices, normalizeDynamicServiceItems,
  reconcileDynamicServiceItems, reconcileUtilityServiceFields, serviceFactsNeedAssist,
} from "./sale-room-summary-services.js";

export * from "./sale-room-summary-foundation.js";
export * from "./sale-room-summary-rooms.js";
export * from "./sale-room-summary-room-availability.js";
export * from "./sale-room-summary-services.js";

export const SALE_ROOM_SUMMARY_AI_PATH = "/api/sales/room-summary/extract";
export const LEGACY_SALE_ROOM_ADDRESS_AI_PATH = "/api/sales/room-summary/address";
export const DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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
  const rooms = reconcileParenthesizedRoomAvailability(source, normalizeDetectedRooms(source, []));
  const summary = {
    address: extractSourceAddress(source),
    rooms,
    roomType: extractSourceRoomType(source),
    elevator: elevatorStatusInSource(source),
    furniture: extractSourceFurniture(source),
    services: reconcileUtilityServiceFields(extractSourceUtilityServices(source), serviceItems),
  };
  return { ...summary, found: summaryFound(summary) };
}

function explicitRoomSignals(sourceValue) {
  return extractSourceRoomMentions(sourceValue).length > 0
    || /(?:phòng|room)\s*[:#-]?\s*(?:p\s*[-:]?\s*)?\d{1,4}(?![\p{L}\p{N}_])/iu.test(sourceValue);
}

function unresolvedRoomFacts(sourceValue, deterministic) {
  if (!explicitRoomSignals(sourceValue)) return false;
  if (!deterministic.rooms.length) return true;
  const source = fold(sourceValue);
  const wantsPrice = /(?:^|\s)(?:gia|price|rent)(?:\s|$)/u.test(source);
  const wantsAvailability = /(?:^|\s)(?:trong|available|availability|vao luon|sap)(?:\s|$)/u.test(source);
  return (wantsPrice && deterministic.rooms.some((room) => !room.price))
    || (wantsAvailability && deterministic.rooms.some((room) => !room.availability));
}

function unresolvedServiceFacts(sourceValue, deterministic) {
  return serviceFactsNeedAssist(sourceValue, deterministic.services);
}

export function semanticAssistFields(sourceValue, deterministicValue = null) {
  const source = normalizeRoomSummarySource(sourceValue);
  const deterministic = deterministicValue || extractDeterministicRoomSummary(source);
  const fields = [];
  if (!deterministic.address && /(?:địa\s*chỉ|dia\s*chi|address)/iu.test(source)) fields.push("address");
  if (unresolvedRoomFacts(source, deterministic)) fields.push("rooms");
  if (!deterministic.furniture && /(?:nội\s*thất|noi\s*that|furniture|đồ\s*đạc|do\s*dac)/iu.test(source)) fields.push("furniture");
  if (unresolvedServiceFacts(source, deterministic)) fields.push("services");
  return fields;
}

function semanticSchema(fields) {
  const properties = {};
  const required = [];
  if (fields.includes("address")) { properties.address = { type: "string" }; required.push("address"); }
  if (fields.includes("rooms")) {
    properties.rooms = {
      type: "array",
      maxItems: MAX_ROOMS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: { room: { type: "string" }, price: { type: "string" }, availability: { type: "string" } },
        required: ["room", "price", "availability"],
      },
    };
    required.push("rooms");
  }
  if (fields.includes("furniture")) {
    properties.furnitureAsImage = { type: "boolean" };
    properties.furnitureItems = { type: "array", items: { type: "string" }, maxItems: MAX_ITEMS };
    required.push("furnitureAsImage", "furnitureItems");
  }
  if (fields.includes("services")) {
    properties.electricity = { type: "string" };
    properties.water = { type: "string" };
    properties.serviceItems = {
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
    required.push("electricity", "water", "serviceItems");
  }
  return { type: "object", additionalProperties: false, properties, required };
}

function semanticInstructions(fields) {
  return `Bạn là bộ ghép evidence cho tin phòng trọ. Rules đã đọc phần chắc chắn.
Chỉ xử lý: ${fields.join(", ")}.
Không được tạo dữ kiện mới. Mọi room, price, availability, address, service value phải xuất hiện nguyên văn trong SOURCE.
Không tự hoàn thiện địa danh. Không làm tròn, đổi đơn vị tiền, hay sửa con số.
1N1K/2N1K/Studio, tầng, diện tích, ngày, mã nguồn không phải mã phòng.
serviceItems phải có evidence nguyên văn liên tục chứa đúng tên/ngữ cảnh và đúng value.
Nếu không chắc, trả chuỗi rỗng hoặc mảng rỗng.`;
}

function extractAiObject(result) {
  const raw = result?.response ?? result?.result ?? result?.text ?? result;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const nested = raw.response ?? raw.result ?? raw.text;
    return nested && typeof nested === "object" && !Array.isArray(nested) ? nested : raw;
  }
  const text = String(raw || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

async function runSemanticAssist(source, fields, env, model) {
  if (!fields.length || !env?.AI?.run) return null;
  const result = await env.AI.run(model, {
    messages: [
      { role: "system", content: semanticInstructions(fields) },
      { role: "user", content: `SOURCE:\n${source}` },
    ],
    response_format: { type: "json_schema", json_schema: semanticSchema(fields) },
    temperature: 0,
    max_tokens: 2000,
  });
  return extractAiObject(result) || {};
}

function mergeSemantic(source, deterministic, detected, fields) {
  const summary = structuredClone(deterministic);
  if (fields.includes("address") && !summary.address) {
    const candidate = normalizeDetectedAddress(detected?.address);
    if (candidate && addressIsGroundedInSource(source, candidate)) summary.address = candidate;
  }
  if (fields.includes("rooms")) {
    summary.rooms = reconcileParenthesizedRoomAvailability(source, normalizeDetectedRooms(source, detected?.rooms));
  }
  if (fields.includes("furniture") && !summary.furniture) {
    summary.furniture = normalizeDetectedFurniture(source, detected?.furnitureItems, detected?.furnitureAsImage);
  }
  if (fields.includes("services")) {
    const aiItems = normalizeDynamicServiceItems(source, detected?.serviceItems);
    const items = reconcileDynamicServiceItems(source, aiItems);
    const aiUtility = normalizeDetectedServices(source, detected?.electricity, detected?.water);
    summary.services = reconcileUtilityServiceFields({
      electricity: summary.services.electricity || aiUtility.electricity,
      water: summary.services.water || aiUtility.water,
    }, items);
  }
  summary.found = summaryFound(summary);
  return summary;
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

  const model = clean(env.SALE_ROOM_SUMMARY_AI_MODEL, 160) || DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL;
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

  const summary = detected ? mergeSemantic(source, deterministic, detected, fields) : deterministic;
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