import * as core from "./sale-room-summary-ai-core.js";

export * from "./sale-room-summary-ai-core.js";

const MAX_RECONCILED_ROOMS = 24;

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
  return /\b\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|m|k)\s*\d*(?:\s*\/\s*(?:tháng|thang))?\b/giu;
}

function sourceAvailabilityDatePattern() {
  return /\b\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?\b/gu;
}

function sourceAvailabilityPhrasePattern() {
  return /\b(?:vào\s+luôn|vao\s+luon|trống\s+ngay|trong\s+ngay|cuối\s+tháng|cuoi\s+thang|đầu\s+tháng|dau\s+thang|giữa\s+tháng|giua\s+thang)\b/giu;
}

function sourceAreaPattern() {
  return /\b\d+(?:[.,]\d+)?\s*m\s*(?:2|²)\b/giu;
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

function addRoomCandidate(candidates, rawValue, index, length, priority, excludedRanges) {
  const range = { start: index, end: index + length };
  if (overlapsAny(range, excludedRanges)) return;

  const room = core.normalizeDetectedRoomField(rawValue)
    .replace(/^(?:phòng|phong|room)\s*[:#-]?\s*/iu, "")
    .trim();
  const identity = roomIdentity(room);
  if (!room || !identity) return;

  candidates.push({ room, identity, index, priority, range });
}

function sourceSegments(value) {
  return String(value ?? "")
    .split(/[\n;|•]+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function lineHasRoomScope(line) {
  const normalized = normalizeComparable(line);
  if (/\b(?:phong|room|trong|available|availability|con|sap|gia|price|rent)\b/u.test(normalized)) {
    return true;
  }
  return /\bp\s*[-:]?\s*\d{1,4}[a-z]?\b/iu.test(line);
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
    const hasAddressCue = /\b(?:dia chi|address|dc)\b/u.test(normalizedLine);
    const excludedRanges = [
      ...collectRanges(line, sourcePricePattern()),
      ...collectRanges(line, sourceAvailabilityDatePattern()),
      ...collectRanges(line, sourceAreaPattern()),
    ];
    const candidates = [];

    for (const match of line.matchAll(/(?:phòng|phong|room)\s*[:#-]?\s*((?:p\s*[-:]?\s*)?[a-z]?\d{1,4}[a-z]?)/giu)) {
      const raw = match[1];
      const relative = match[0].lastIndexOf(raw);
      addRoomCandidate(
        candidates,
        raw,
        (match.index ?? 0) + Math.max(relative, 0),
        raw.length,
        4,
        excludedRanges,
      );
    }

    for (const match of line.matchAll(/\bp\s*[-:]?\s*\d{1,4}[a-z]?\b/giu)) {
      addRoomCandidate(candidates, match[0], match.index ?? 0, match[0].length, 3, excludedRanges);
    }

    for (const match of line.matchAll(/\b[a-z]{1,3}\d{1,4}[a-z]?\b/giu)) {
      addRoomCandidate(candidates, match[0], match.index ?? 0, match[0].length, 2, excludedRanges);
    }

    if (!hasAddressCue) {
      for (const match of line.matchAll(/\b\d{2,4}\b/gu)) {
        addRoomCandidate(candidates, match[0], match.index ?? 0, match[0].length, 1, excludedRanges);
      }
    }

    candidates.sort((a, b) => a.index - b.index || b.priority - a.priority);
    for (const candidate of candidates) {
      const existing = byIdentity.get(candidate.identity);
      const absoluteIndex = sourceOffset + candidate.index;
      if (!existing) {
        byIdentity.set(candidate.identity, { ...candidate, index: absoluteIndex });
        continue;
      }
      if (candidate.priority > existing.priority) {
        byIdentity.set(candidate.identity, {
          ...candidate,
          index: existing.index,
        });
      }
    }

    sourceOffset += line.length + 1;
  }

  return [...byIdentity.values()]
    .sort((a, b) => a.index - b.index)
    .slice(0, MAX_RECONCILED_ROOMS)
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
  return uniqueSourceValues(
    [...String(sourceValue ?? "").matchAll(sourcePricePattern())].map((match) => match[0]),
  );
}

function sourceAvailabilityValues(sourceValue) {
  const values = [];
  for (const line of sourceSegments(sourceValue)) {
    const normalized = normalizeComparable(line);
    const hasAvailabilityCue = /\b(?:trong|available|availability|con|sap|vao luon)\b/u.test(normalized);
    if (!hasAvailabilityCue) continue;

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

function uniqueAssociatedValue(sourceValue, room, roomValues, values, fieldKind) {
  const matches = uniqueSourceValues(values.filter((value) => (
    core.roomFieldIsAssociatedInSource(sourceValue, room, value, roomValues, fieldKind)
  )));
  return matches.length === 1 ? matches[0] : "";
}

function mergeRowsBySourceIdentity(sourceValue, sourceMentions, aiRows) {
  const rows = [];
  const byIdentity = new Map();

  for (const mention of sourceMentions) {
    if (core.roomIsExplicitlyUnavailableInSource(sourceValue, mention.room)) continue;
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

    if (!core.roomIdentifierIsGroundedInSource(sourceValue, room)) continue;
    if (core.roomIsExplicitlyUnavailableInSource(sourceValue, room)) continue;

    const row = {
      room,
      price: String(raw?.price ?? "").trim(),
      availability: String(raw?.availability ?? "").trim(),
    };
    byIdentity.set(identity, row);
    rows.push(row);
  }

  return rows.slice(0, MAX_RECONCILED_ROOMS);
}

export function normalizeDetectedRooms(sourceValue, roomValues) {
  const aiRows = core.normalizeDetectedRooms(
    sourceValue,
    Array.isArray(roomValues) ? roomValues : [],
  );
  const sourceMentions = extractSourceRoomMentions(sourceValue);
  const rows = mergeRowsBySourceIdentity(sourceValue, sourceMentions, aiRows);
  const roomValuesInSource = rows.map((row) => row.room).filter(Boolean);
  if (!roomValuesInSource.length) return rows;

  const prices = uniqueSourceValues([
    ...sourcePriceValues(sourceValue),
    ...aiRows.map((row) => row.price).filter(Boolean),
  ]);
  const availabilities = uniqueSourceValues([
    ...sourceAvailabilityValues(sourceValue),
    ...aiRows.map((row) => row.availability).filter(Boolean),
  ]);

  for (const row of rows) {
    if (!row.room) continue;

    const sourcePrice = uniqueAssociatedValue(
      sourceValue,
      row.room,
      roomValuesInSource,
      prices,
      "price",
    );
    if (sourcePrice) row.price = sourcePrice;

    const sourceAvailability = uniqueAssociatedValue(
      sourceValue,
      row.room,
      roomValuesInSource,
      availabilities,
      "availability",
    );
    if (sourceAvailability) row.availability = sourceAvailability;
  }

  return rows;
}

function responseWithReconciledRooms(response, payload, rooms) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  const nextPayload = {
    ...payload,
    rooms,
    found: Boolean(
      payload?.address
      || rooms.length
      || payload?.roomType
      || payload?.elevator
      || payload?.furniture
      || payload?.services?.electricity
      || payload?.services?.water
    ),
  };

  return new Response(JSON.stringify(nextPayload), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handleSaleRoomSummaryAiRequest(request, env) {
  const sourceRequest = request.method === "POST" ? request.clone() : null;
  const response = await core.handleSaleRoomSummaryAiRequest(request, env);
  if (!sourceRequest || !response.ok) return response;

  const [body, payload] = await Promise.all([
    sourceRequest.json().catch(() => ({})),
    response.clone().json().catch(() => null),
  ]);
  if (!payload?.ok) return response;

  const source = core.normalizeRoomSummarySource(body?.source);
  if (!source) return response;

  const rooms = normalizeDetectedRooms(source, payload.rooms);
  return responseWithReconciledRooms(response, payload, rooms);
}
