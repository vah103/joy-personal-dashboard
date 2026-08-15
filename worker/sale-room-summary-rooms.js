import {
  MAX_ROOMS,
  clean,
  fold,
  normalizeRoomSummarySource,
  phraseGrounded,
  sourceLines,
} from "./sale-room-summary-foundation.js";

function roomIdentity(value) {
  const normalized = fold(value)
    .replace(/^(?:phong|room)\s+/u, "")
    .replace(/\s+/g, "");
  if (!normalized) return "";
  if (/^(?:studio|stuido|don|gacxep|\d+n1k|\d+n)$/u.test(normalized)) return "";
  const numeric = normalized.match(/^p?(\d{1,4})$/u);
  if (numeric) return `number:${numeric[1]}`;
  if (/^[a-z]{1,3}\d{1,4}[a-z]?$/u.test(normalized)) return `code:${normalized}`;
  return "";
}

function ranges(value, pattern) {
  return [...String(value ?? "").matchAll(pattern)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}
function overlaps(a, b) { return a.start < b.end && b.start < a.end; }
function inRanges(range, list) { return list.some((item) => overlaps(range, item)); }

const AREA_RE = /(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)?\s*m\s*(?:2|²)(?![\p{L}\p{N}_])/giu;
const FLOOR_RE = /(?<![\p{L}\p{N}_])(?:tầng|tang|floor)\s*[:#-]?\s*\d{1,2}(?![\p{L}\p{N}_])/giu;
const DATE_RE = /(?<![\p{L}\p{N}_])(?:\d{1,2}\s*\/\s*(?:\d{1,2}(?:\s*\/\s*\d{2,4})?|\d{4})|\d{4}\s*-\s*\d{1,2}\s*-\s*\d{1,2})(?![\p{L}\p{N}_])/gu;
const PERCENT_RE = /(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)?\s*%(?![\p{L}\p{N}_])/gu;
const NON_ROOM_NUMBER_RE = /(?<![\p{L}\p{N}_])(?:mã|ma|code|id|hh|hoa\s*hồng|hoa\s*hong|cọc|coc|deposit)\s*[:#=-]?\s*(?:p\s*[-:]?\s*\d{1,4}[a-z]?|[a-z]{1,3}\d{1,4}[a-z]?|\d{2,4})(?![\p{L}\p{N}_])/giu;
const ROOMTYPE_RE = /(?<![\p{L}\p{N}_])(?:studio|stuido|gác\s*xép|gac\s*xep|đơn|don|[1-9]\d*\s*n\s*1\s*k)(?![\p{L}\p{N}_])/giu;
const RENT_RE = /(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|m|k)\s*\d*(?:\s*\/\s*(?:tháng|thang))?(?![\p{L}\p{N}_])/giu;
const AVAILABILITY_TEXT_RE = /(?<![\p{L}\p{N}_])(?:vào\s+luôn|vao\s+luon|trống\s+ngay|trong\s+ngay|cuối\s+tháng|cuoi\s+thang|đầu\s+tháng|dau\s+thang|giữa\s+tháng|giua\s+thang)(?![\p{L}\p{N}_])/giu;

function roomClauses(value) {
  const protectedText = String(value ?? "")
    .replace(/(\d)\.(\d)/g, "$1§DOT§$2")
    .replace(/(\d),(\d)/g, "$1§COMMA§$2");
  return protectedText
    .split(/[\n;,|•.!?]+/u)
    .map((part) => part
      .replace(/§DOT§/g, ".")
      .replace(/§COMMA§/g, ",")
      .trim())
    .filter(Boolean);
}

function roomSourceSegments(value) {
  return sourceLines(value).flatMap((line) => line
    .replace(/(\d)\.(\d)/g, "$1§DOT§$2")
    .replace(/(\d),(\d)/g, "$1§COMMA§$2")
    .split(/[.!?;]+/u)
    .map((part) => part.replace(/§DOT§/g, ".").replace(/§COMMA§/g, ",").trim())
    .filter(Boolean));
}

function roomScopedLine(line) {
  const normalized = fold(line);
  return /(?:^|\s)(?:phong|room|trong|available|availability|con|sap|gia|price|rent)(?:\s|$)/u.test(normalized)
    || /(?<![\p{L}\p{N}_])p\s*[-:]?\s*\d{1,4}[a-z]?(?![\p{L}\p{N}_])/iu.test(line);
}

function addRoomCandidate(map, raw, index, priority, excluded) {
  const range = { start: index, end: index + raw.length };
  if (inRanges(range, excluded)) return;
  const room = clean(raw, 40)
    .replace(/^(?:phòng|phong|room)\s*[:#-]?\s*/iu, "")
    .replace(/\s+/g, "");
  const identity = roomIdentity(room);
  if (!identity) return;
  const existing = map.get(identity);
  if (!existing || priority > existing.priority) map.set(identity, { room, identity, index, priority });
}

export function extractSourceRoomMentions(sourceValue) {
  const output = new Map();
  let offset = 0;
  for (const line of roomSourceSegments(sourceValue)) {
    if (!roomScopedLine(line) || /^(?:🏢)?\s*(?:địa\s*chỉ|dia\s*chi|address|đc|dc)\b/iu.test(line)) {
      offset += line.length + 1;
      continue;
    }
    const excluded = [
      ...ranges(line, AREA_RE),
      ...ranges(line, FLOOR_RE),
      ...ranges(line, DATE_RE),
      ...ranges(line, PERCENT_RE),
      ...ranges(line, NON_ROOM_NUMBER_RE),
      ...ranges(line, ROOMTYPE_RE),
      ...ranges(line, RENT_RE),
    ];
    const local = new Map();

    for (const match of line.matchAll(/(?:phòng|phong|room)\s*[:#-]?\s*((?:p\s*[-:]?\s*)?\d{1,4}|[a-z]{1,3}\d{1,4}[a-z]?)(?![\p{L}\p{N}_])/giu)) {
      const raw = match[1];
      addRoomCandidate(local, raw, (match.index ?? 0) + match[0].lastIndexOf(raw), 4, excluded);
    }
    for (const match of line.matchAll(/(?<![\p{L}\p{N}_])p\s*[-:]?\s*\d{1,4}[a-z]?(?![\p{L}\p{N}_])/giu)) {
      addRoomCandidate(local, match[0], match.index ?? 0, 3, excluded);
    }
    for (const match of line.matchAll(/(?<![\p{L}\p{N}_])[a-z]{1,3}\d{1,4}[a-z]?(?![\p{L}\p{N}_])/giu)) {
      addRoomCandidate(local, match[0], match.index ?? 0, 2, excluded);
    }

    const normalized = fold(line);
    const allowsBare = /(?:^|\s)(?:phong|room|trong|available|availability|con|sap|gia|price|rent)(?:\s|$)/u.test(normalized)
      || [...local.values()].some((item) => /^p/i.test(item.room));
    if (allowsBare) {
      for (const match of line.matchAll(/(?<![\p{L}\p{N}_])\d{2,4}(?![\p{L}\p{N}_])/gu)) {
        addRoomCandidate(local, match[0], match.index ?? 0, 1, excluded);
      }
    }

    for (const item of local.values()) {
      const existing = output.get(item.identity);
      const absolute = { ...item, index: offset + item.index };
      if (!existing || item.priority > existing.priority) output.set(item.identity, absolute);
    }
    offset += line.length + 1;
  }
  return [...output.values()]
    .sort((a, b) => a.index - b.index)
    .slice(0, MAX_ROOMS)
    .map(({ room, identity }) => ({ room, identity }));
}

export function roomFieldIsGroundedInSource(sourceValue, fieldValue) {
  return phraseGrounded(sourceValue, fieldValue);
}

export function roomIdentifierIsGroundedInSource(sourceValue, roomValue) {
  const identity = roomIdentity(roomValue);
  return Boolean(identity) && extractSourceRoomMentions(sourceValue).some((item) => item.identity === identity);
}

const UNAVAILABLE_RE = /(?:^|\s)(?:da coc|coc roi|da giu|giu roi|da thue|thue roi)(?:\s|$)/u;

export function roomIsExplicitlyUnavailableInSource(sourceValue, roomValue) {
  const identity = roomIdentity(roomValue);
  if (!identity) return false;
  return roomClauses(sourceValue).some((clause) => {
    const mention = extractSourceRoomMentions(clause).some((item) => item.identity === identity);
    return mention && UNAVAILABLE_RE.test(` ${fold(clause)} `);
  });
}

function rentValues(sourceValue) {
  const values = [];
  for (const line of sourceLines(sourceValue)) {
    if (!/(?:^|\s)(?:gia|price|rent)(?:\s|$)/u.test(fold(line)) && !extractSourceRoomMentions(line).length) continue;
    for (const match of line.matchAll(RENT_RE)) values.push(match[0].trim());
  }
  return [...new Set(values)];
}

function availabilityValues(sourceValue) {
  const values = [];
  for (const line of sourceLines(sourceValue)) {
    const normalized = fold(line);
    if (!/(?:^|\s)(?:trong|available|availability|con|sap|vao luon)(?:\s|$)/u.test(normalized)) continue;
    for (const match of line.matchAll(DATE_RE)) values.push(match[0].trim());
    for (const match of line.matchAll(AVAILABILITY_TEXT_RE)) values.push(match[0].trim());
  }
  return [...new Set(values)];
}

function fieldKind(value) {
  const candidate = String(value ?? "");
  const rent = new RegExp(RENT_RE.source, "iu");
  if (rent.test(candidate)) return "price";
  const date = new RegExp(DATE_RE.source, "u");
  if (date.test(candidate)) return "availability";
  const normalized = fold(value);
  if (/(?:^|\s)(?:vao luon|trong ngay|cuoi thang|dau thang|giua thang)(?:\s|$)/u.test(normalized)) return "availability";
  return "";
}

function positions(haystackValue, needleValue) {
  const haystack = ` ${fold(haystackValue)} `;
  const needle = ` ${fold(needleValue)} `;
  const out = [];
  let at = 0;
  while (needle.trim() && (at = haystack.indexOf(needle, at)) >= 0) {
    out.push(at);
    at += Math.max(needle.length - 1, 1);
  }
  return out;
}

function fieldPositions(clause, kind) {
  const matches = kind === "price"
    ? [...clause.matchAll(new RegExp(RENT_RE.source, "giu"))]
    : kind === "availability"
      ? [
        ...clause.matchAll(new RegExp(DATE_RE.source, "gu")),
        ...clause.matchAll(new RegExp(AVAILABILITY_TEXT_RE.source, "giu")),
      ]
      : [];
  return matches
    .map((match) => ({ value: match[0].trim(), p: match.index ?? 0 }))
    .sort((a, b) => a.p - b.p);
}

function roomPositions(clause) {
  return extractSourceRoomMentions(clause)
    .flatMap((mention) => positions(clause, mention.room).map((p) => ({
      identity: mention.identity,
      value: mention.room,
      p,
    })))
    .sort((a, b) => a.p - b.p);
}

function pairedFieldBelongsToRoom(clause, targetIdentity, field, kind) {
  const rooms = roomPositions(clause);
  const fields = fieldPositions(clause, kind);
  if (rooms.length < 2 || fields.length !== rooms.length) return null;

  let valid = false;
  if (rooms[0].p < fields[0].p) {
    valid = rooms.every((room, index) => (
      room.p < fields[index].p
      && (index === rooms.length - 1 || fields[index].p < rooms[index + 1].p)
    ));
  } else if (fields[0].p < rooms[0].p) {
    valid = fields.every((candidate, index) => (
      candidate.p < rooms[index].p
      && (index === fields.length - 1 || rooms[index].p < fields[index + 1].p)
    ));
  }
  if (!valid) return null;

  const wanted = fold(field);
  return rooms.some((room, index) => (
    room.identity === targetIdentity && fold(fields[index].value) === wanted
  ));
}

function uniqueAssociated(sourceValue, roomValue, candidates, kind) {
  const rooms = extractSourceRoomMentions(sourceValue);
  const valid = [];
  for (const candidate of candidates) {
    if (roomFieldIsAssociatedInSource(sourceValue, roomValue, candidate, rooms.map((item) => item.room), kind)) valid.push(candidate);
  }
  const unique = [...new Set(valid)];
  return unique.length === 1 ? unique[0] : "";
}

export function roomFieldIsAssociatedInSource(sourceValue, roomValue, fieldValue, roomValues = [], explicitKind = "") {
  const field = clean(fieldValue, 80);
  if (!field || !roomFieldIsGroundedInSource(sourceValue, field)) return false;
  const kind = explicitKind || fieldKind(field);
  const room = clean(roomValue, 40);
  const roomIds = roomValues.map((value) => ({ value, identity: roomIdentity(value) })).filter((item) => item.identity);

  for (const clause of roomClauses(sourceValue)) {
    if (!phraseGrounded(clause, field)) continue;
    const clauseMentions = extractSourceRoomMentions(clause);
    const clauseIds = new Set(clauseMentions.map((item) => item.identity));
    const clauseRooms = roomIds.filter((item) => clauseIds.has(item.identity));
    if (room) {
      const targetIdentity = roomIdentity(room);
      const target = clauseRooms.find((item) => item.identity === targetIdentity);
      if (target) {
        if (clauseRooms.length <= 1) return true;

        const paired = pairedFieldBelongsToRoom(clause, targetIdentity, field, kind);
        if (paired !== null) return paired;

        const fp = positions(clause, field);
        const rp = roomPositions(clause);
        if (fp.length === 1 && rp.length) {
          const minR = Math.min(...rp.map((x) => x.p));
          const maxR = Math.max(...rp.map((x) => x.p));
          if (fp[0] < minR || fp[0] > maxR) {
            const numberOfSameKind = fieldPositions(clause, kind).length || 1;
            if (numberOfSameKind === 1) return true;
          }
          const distances = rp.map((x) => ({ ...x, d: Math.abs(x.p - fp[0]) }));
          const min = Math.min(...distances.map((x) => x.d));
          const nearest = distances.filter((x) => x.d === min);
          if (nearest.length === 1 && nearest[0].identity === targetIdentity) return true;
        }
      }
    } else if (!clauseRooms.length) {
      const normalized = fold(clause);
      if (kind === "price" && /(?:^|\s)(?:gia|price|rent)(?:\s|$)/u.test(normalized)) return true;
      if (kind === "availability" && /(?:^|\s)(?:trong|available|availability|vao luon|con|sap)(?:\s|$)/u.test(normalized)) return true;
    }
  }

  if (room) {
    const targetIdentity = roomIdentity(room);
    const allRooms = extractSourceRoomMentions(sourceValue);
    if (allRooms.length >= 1) {
      for (const clause of roomClauses(sourceValue)) {
        if (!phraseGrounded(clause, field) || extractSourceRoomMentions(clause).length) continue;
        const normalized = fold(clause);
        if (kind === "price" && /(?:^|\s)(?:gia|price|rent)(?:\s|$)/u.test(normalized)) return Boolean(targetIdentity);
        if (kind === "availability" && /(?:^|\s)(?:trong|available|availability|ngay trong)(?:\s|$)/u.test(normalized)) return Boolean(targetIdentity);
      }
    }
  }
  return false;
}

export function normalizeDetectedRooms(sourceValue, roomValues) {
  const source = normalizeRoomSummarySource(sourceValue);
  const mentions = extractSourceRoomMentions(source).filter((item) => !roomIsExplicitlyUnavailableInSource(source, item.room));
  const prices = rentValues(source);
  const availabilities = availabilityValues(source);
  const rows = mentions.map((mention) => ({
    room: mention.room,
    price: uniqueAssociated(source, mention.room, prices, "price"),
    availability: uniqueAssociated(source, mention.room, availabilities, "availability"),
  }));

  if (!rows.length) {
    const price = prices.length === 1 && sourceLines(source).some((line) => /(?:^|\s)(?:gia|price|rent)(?:\s|$)/u.test(fold(line))) ? prices[0] : "";
    const availability = availabilities.length === 1 ? availabilities[0] : "";
    return price || availability ? [{ room: "", price, availability }] : [];
  }

  const aiRows = Array.isArray(roomValues) ? roomValues.slice(0, MAX_ROOMS) : [];
  for (const row of rows) {
    const identity = roomIdentity(row.room);
    const candidates = aiRows.filter((ai) => roomIdentity(ai?.room) === identity);
    if (!row.price && candidates.length) {
      const grounded = [...new Set(candidates.map((ai) => clean(ai?.price, 80)).filter((value) => value && roomFieldIsAssociatedInSource(source, row.room, value, rows.map((r) => r.room), "price")))];
      if (grounded.length === 1) row.price = grounded[0];
    }
    if (!row.availability && candidates.length) {
      const grounded = [...new Set(candidates.map((ai) => clean(ai?.availability, 80)).filter((value) => value && roomFieldIsAssociatedInSource(source, row.room, value, rows.map((r) => r.room), "availability")))];
      if (grounded.length === 1) row.availability = grounded[0];
    }
  }
  return rows;
}
