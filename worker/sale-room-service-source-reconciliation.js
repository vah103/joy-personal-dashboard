import { normalizeDynamicServiceItems } from "./sale-room-service-items-ai.js";

const MAX_SERVICE_ITEMS = 16;

const RATE_SOURCE = String.raw`(?:\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|m|k|nghìn|nghin|đ|d|vnd)\s*\d*(?:\s*\/\s*(?:1\s*)?(?:ng|người|nguoi|phòng|phong|xe|tháng|thang|m3|m³|khối|khoi|số|so|kwh))?|\d+(?:[.,]\d+)?\s*\/\s*(?:1\s*)?(?:ng|người|nguoi|phòng|phong|xe|tháng|thang|m3|m³|khối|khoi|số|so|kwh)|(?:miễn\s+phí|mien\s+phi|free))`;

const COMMON_LABEL_SOURCE = String.raw`(?:phí\s+(?:dịch\s+vụ|dv)\s+chung|dịch\s+vụ\s+chung|dv\s+chung|phí\s+chung|phí\s+(?:dịch\s+vụ|dv)|dịch\s+vụ|dv)`;

const PACKAGE_MEMBER_PATTERNS = Object.freeze([
  { value: "mạng", pattern: /\b(?:mạng|internet|wifi)\b/iu },
  { value: "vệ sinh", pattern: /\b(?:vệ\s+sinh|vs)\b/iu },
  { value: "rác", pattern: /\b(?:rác|rác\s+thải)\b/iu },
  { value: "máy giặt", pattern: /\b(?:máy\s+giặt(?:\s+chung)?|giặt\s+chung)\b/iu },
  { value: "gửi xe", pattern: /\b(?:gửi\s+xe|xe\s+máy|parking|phí\s+xe)\b/iu },
  { value: "điện chung", pattern: /\b(?:điện\s+chung|điện\s+hành\s+lang)\b/iu },
  { value: "nước chung", pattern: /\bnước\s+chung\b/iu },
  { value: "camera", pattern: /\bcamera\b/iu },
  { value: "bảo vệ", pattern: /\bbảo\s+vệ\b/iu },
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
    .trim();
}

function hasRate(value) {
  return new RegExp(RATE_SOURCE, "iu").test(String(value ?? ""));
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
  const pieces = String(sourceValue ?? "")
    .split(/[\n;|•]+/u)
    .map((piece) => piece.trim())
    .filter(Boolean);

  const segments = [];
  for (let index = 0; index < pieces.length; index += 1) {
    let segment = pieces[index];
    const commonRate = new RegExp(`${COMMON_LABEL_SOURCE}\\s*[:：=-]?\\s*${RATE_SOURCE}`, "iu").test(segment);
    if (commonRate && index + 1 < pieces.length && looksLikePackageContinuation(pieces[index + 1])) {
      segment = `${segment} ${pieces[index + 1]}`;
      index += 1;
    }
    segments.push(segment);
  }
  return segments;
}

function packageIncludes(segment, rateEnd) {
  const tail = String(segment ?? "").slice(rateEnd);
  const includes = [];
  for (const definition of PACKAGE_MEMBER_PATTERNS) {
    if (definition.pattern.test(tail)) includes.push(definition.value);
  }
  return [...new Set(includes)];
}

function commonCandidates(segment) {
  const candidates = [];
  const pattern = new RegExp(`(${COMMON_LABEL_SOURCE})\\s*[:：=-]?\\s*(${RATE_SOURCE})`, "giu");

  for (const match of segment.matchAll(pattern)) {
    const full = match[0];
    const rate = match[2];
    const rateOffset = full.lastIndexOf(rate);
    const rateEnd = (match.index ?? 0) + Math.max(rateOffset, 0) + rate.length;
    candidates.push({
      kind: "common",
      name: "Dịch vụ chung",
      value: rate,
      includes: packageIncludes(segment, rateEnd),
      evidence: segment,
    });
  }

  return candidates;
}

function explicitServiceCandidates(segment) {
  const candidates = [];

  for (const definition of EXPLICIT_SERVICE_DEFINITIONS) {
    const pattern = new RegExp(`\\b(${definition.label})\\b\\s*[:：=-]?\\s*(${RATE_SOURCE})`, "giu");
    for (const match of segment.matchAll(pattern)) {
      candidates.push({
        kind: definition.kind,
        name: definition.name,
        value: match[2],
        includes: [],
        evidence: segment,
      });
    }
  }

  return candidates;
}

export function extractSourceDynamicServiceItems(sourceValue) {
  const candidates = [];
  for (const segment of sourceServiceSegments(sourceValue)) {
    candidates.push(...commonCandidates(segment));
    candidates.push(...explicitServiceCandidates(segment));
  }
  return normalizeDynamicServiceItems(sourceValue, candidates);
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

function packageContainsItem(pkg, item) {
  if (pkg.kind !== "common" || item.kind === "common") return false;
  const itemName = normalizeComparable(item.name);
  if (!itemName) return false;
  return normalizeRateIdentity(pkg.value) === normalizeRateIdentity(item.value)
    && (pkg.includes || []).some((value) => normalizeComparable(value) === itemName);
}

export function reconcileDynamicServiceItems(sourceValue, aiItems) {
  const sourceItems = extractSourceDynamicServiceItems(sourceValue);
  const byIdentity = new Map();

  for (const item of [...(Array.isArray(aiItems) ? aiItems : []), ...sourceItems]) {
    const name = String(item?.name ?? "").trim();
    const value = String(item?.value ?? "").trim();
    const kind = String(item?.kind ?? "other").trim() || "other";
    if (!name || !value) continue;

    const identity = `${kind}|${normalizeComparable(name)}|${normalizeRateIdentity(value)}`;
    const existing = byIdentity.get(identity);
    if (existing) {
      existing.includes = mergeIncludes(existing.includes, item?.includes);
      continue;
    }

    byIdentity.set(identity, {
      kind,
      name,
      value,
      includes: mergeIncludes([], item?.includes),
    });
  }

  const merged = [...byIdentity.values()];
  const packages = merged.filter((item) => item.kind === "common");
  return merged
    .filter((item) => item.kind === "common" || !packages.some((pkg) => packageContainsItem(pkg, item)))
    .slice(0, MAX_SERVICE_ITEMS);
}
