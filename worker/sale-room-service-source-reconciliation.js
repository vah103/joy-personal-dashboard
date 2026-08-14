const MAX_SERVICE_ITEMS = 16;

const RATE_SOURCE = String.raw`(?:\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|m|k|nghìn|nghin|đ|d|vnd)\s*\d*(?:\s*\/\s*(?:1\s*)?(?:ng|người|nguoi|phòng|phong|xe|tháng|thang|m3|m³|khối|khoi|số|so|kwh))?|\d+(?:[.,]\d+)?\s*\/\s*(?:1\s*)?(?:ng|người|nguoi|phòng|phong|xe|tháng|thang|m3|m³|khối|khoi|số|so|kwh)|(?:miễn\s+phí|mien\s+phi|free))`;
const COMMON_LABEL_SOURCE = String.raw`(?:phí\s+(?:dịch\s+vụ|dv)\s+chung|dịch\s+vụ\s+chung|dv\s+chung|phí\s+chung|phí\s+(?:dịch\s+vụ|dv)|dịch\s+vụ|dv)`;
const SHARED_UTILITY_LABEL_SOURCE = String.raw`(?:điện\s*(?:\+|&|và)?\s*nước|nước\s*(?:\+|&|và)?\s*điện)`;

const PACKAGE_MEMBER_PATTERNS = Object.freeze([
  { value: "Mạng", pattern: /(?<![\p{L}\p{N}_])(?:mạng|internet|wifi)(?![\p{L}\p{N}_])/iu },
  { value: "Vệ sinh", pattern: /(?<![\p{L}\p{N}_])(?:vệ\s+sinh|vs)(?![\p{L}\p{N}_])/iu },
  { value: "Rác", pattern: /(?<![\p{L}\p{N}_])(?:rác|rác\s+thải)(?![\p{L}\p{N}_])/iu },
  { value: "Máy giặt chung", pattern: /(?<![\p{L}\p{N}_])(?:máy\s+giặt(?:\s+chung)?|giặt\s+chung)(?![\p{L}\p{N}_])/iu },
  { value: "Gửi xe", pattern: /(?<![\p{L}\p{N}_])(?:gửi\s+xe|xe\s+máy|parking|phí\s+xe)(?![\p{L}\p{N}_])/iu },
  { value: "Điện chung", pattern: /(?<![\p{L}\p{N}_])(?:điện\s+chung|điện\s+hành\s+lang)(?![\p{L}\p{N}_])/iu },
  { value: "Nước chung", pattern: /(?<![\p{L}\p{N}_])nước\s+chung(?![\p{L}\p{N}_])/iu },
  { value: "Điện", pattern: /(?<![\p{L}\p{N}_])điện(?!\s+(?:chung|hành\s+lang))(?![\p{L}\p{N}_])/iu },
  { value: "Nước", pattern: /(?<![\p{L}\p{N}_])nước(?!\s+chung)(?![\p{L}\p{N}_])/iu },
  { value: "Camera", pattern: /(?<![\p{L}\p{N}_])camera(?![\p{L}\p{N}_])/iu },
  { value: "Bảo vệ", pattern: /(?<![\p{L}\p{N}_])bảo\s+vệ(?![\p{L}\p{N}_])/iu },
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
    .replace(/\/(?:1)?(?:so|kwh)$/u, "/so")
    .trim();
}

function formatSourceServiceValue(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\bK\b/g, "k")
    .replace(/\/(?:1\s*)?(?:ng|người|nguoi)$/iu, "/người")
    .replace(/\/(?:1\s*)?(?:m3|m³|khối|khoi)$/iu, "/khối")
    .replace(/\/(?:1\s*)?(?:phòng|phong)$/iu, "/phòng")
    .replace(/\/(?:1\s*)?xe$/iu, "/xe")
    .replace(/\/(?:1\s*)?(?:tháng|thang)$/iu, "/tháng")
    .replace(/\/(?:1\s*)?(?:số|so|kwh)$/iu, "/số");
}

function rateMatches(value) {
  return [...String(value ?? "").matchAll(new RegExp(RATE_SOURCE, "giu"))].map((match) => ({
    value: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function hasRate(value) {
  return rateMatches(value).length > 0;
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
    const commonRate = new RegExp(`(?<![\\p{L}\\p{N}_])${COMMON_LABEL_SOURCE}(?![\\p{L}\\p{N}_])\\s*[:：=-]?\\s*${RATE_SOURCE}`, "iu").test(segment);
    if (commonRate && index + 1 < pieces.length && looksLikePackageContinuation(pieces[index + 1])) {
      segment = `${segment} ${pieces[index + 1]}`;
      index += 1;
    }
    segments.push(segment);
  }
  return segments;
}

function packageIncludes(segment, rateEnd = 0) {
  const tail = String(segment ?? "").slice(rateEnd);
  const includes = [];
  for (const definition of PACKAGE_MEMBER_PATTERNS) {
    if (definition.pattern.test(tail)) includes.push(definition.value);
  }
  return [...new Set(includes)];
}

function utilitySpecificRate(value) {
  const normalized = normalizeRateIdentity(value);
  return /\/(?:so|khoi)$/u.test(normalized);
}

function tailStartsWithUtilityCue(value) {
  const normalized = normalizeComparable(value);
  return /^(?:dien|nuoc)\b/u.test(normalized);
}

function genericCommonScopeIsClear(label, rate, tail, includes) {
  const normalizedLabel = normalizeComparable(label);
  if (/\bchung\b/u.test(normalizedLabel) || normalizedLabel === "phi chung") return true;
  if (includes.length) return true;
  const normalizedTail = normalizeComparable(tail);
  if (/^(?:gom|bao gom|incl|including)\b/u.test(normalizedTail)) return true;
  if (utilitySpecificRate(rate) || tailStartsWithUtilityCue(tail)) return false;
  return true;
}

function commonCandidates(segment) {
  const candidates = [];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${COMMON_LABEL_SOURCE})(?![\\p{L}\\p{N}_])\\s*[:：=-]?\\s*(${RATE_SOURCE})`, "giu");

  for (const match of segment.matchAll(pattern)) {
    const full = match[0];
    const rate = match[2];
    const rateOffset = full.lastIndexOf(rate);
    const rateEnd = (match.index ?? 0) + Math.max(rateOffset, 0) + rate.length;
    const tail = segment.slice(rateEnd);
    const includes = packageIncludes(segment, rateEnd);
    if (!genericCommonScopeIsClear(match[1], rate, tail, includes)) continue;
    candidates.push({
      kind: "common",
      name: "Dịch vụ chung",
      value: formatSourceServiceValue(rate),
      includes,
    });
  }

  return candidates;
}

function sharedUtilityCandidates(segment) {
  const candidates = [];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${SHARED_UTILITY_LABEL_SOURCE})(?![\\p{L}\\p{N}_])\\s*[:：=-]?\\s*(${RATE_SOURCE})`, "giu");
  for (const match of segment.matchAll(pattern)) {
    candidates.push({
      kind: "other",
      name: "Điện + nước",
      value: formatSourceServiceValue(match[2]),
      includes: [],
    });
  }
  return candidates;
}

function explicitServiceCandidates(segment) {
  const candidates = [];

  for (const definition of EXPLICIT_SERVICE_DEFINITIONS) {
    const forward = new RegExp(`(?<![\\p{L}\\p{N}_])(${definition.label})(?![\\p{L}\\p{N}_])\\s*[:：=-]?\\s*(${RATE_SOURCE})`, "giu");
    for (const match of segment.matchAll(forward)) {
      candidates.push({
        kind: definition.kind,
        name: definition.name,
        value: formatSourceServiceValue(match[2]),
        includes: [],
      });
    }

    const reverse = new RegExp(`(${RATE_SOURCE})\\s*[:：=-]?\\s*(?<![\\p{L}\\p{N}_])(${definition.label})(?![\\p{L}\\p{N}_])`, "giu");
    for (const match of segment.matchAll(reverse)) {
      candidates.push({
        kind: definition.kind,
        name: definition.name,
        value: formatSourceServiceValue(match[1]),
        includes: [],
      });
    }
  }

  return candidates;
}

function memberBundleCandidates(segment) {
  const rates = rateMatches(segment);
  if (rates.length !== 1) return [];
  const includes = packageIncludes(segment, 0);
  if (includes.length < 2) return [];

  const normalized = normalizeComparable(segment);
  const hasBundleCue = /(?:^|\s)(?:gom|bao gom)(?:\s|$)/u.test(normalized)
    || /\s(?:va|voi)\s/u.test(normalized)
    || /[+&]/u.test(segment);
  if (!hasBundleCue) return [];

  return [{
    kind: "common",
    name: "Dịch vụ chung",
    value: formatSourceServiceValue(rates[0].value),
    includes,
  }];
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

function dedupeSourceItems(items) {
  const byIdentity = new Map();
  for (const item of items) {
    const identity = `${item.kind}|${normalizeComparable(item.name)}|${normalizeRateIdentity(item.value)}`;
    const existing = byIdentity.get(identity);
    if (existing) {
      existing.includes = mergeIncludes(existing.includes, item.includes);
      continue;
    }
    byIdentity.set(identity, {
      kind: item.kind,
      name: item.name,
      value: item.value,
      includes: mergeIncludes([], item.includes),
    });
  }
  return [...byIdentity.values()];
}

export function extractSourceDynamicServiceItems(sourceValue) {
  const candidates = [];
  for (const segment of sourceServiceSegments(sourceValue)) {
    candidates.push(...commonCandidates(segment));
    candidates.push(...sharedUtilityCandidates(segment));
    candidates.push(...explicitServiceCandidates(segment));
    candidates.push(...memberBundleCandidates(segment));
  }
  return dedupeSourceItems(candidates).slice(0, MAX_SERVICE_ITEMS);
}

function semanticIdentity(item) {
  return `${String(item?.kind ?? "other").trim() || "other"}|${normalizeComparable(item?.name)}`;
}

function fullIdentity(item) {
  return `${semanticIdentity(item)}|${normalizeRateIdentity(item?.value)}`;
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
  const sourceBySemantic = new Map(sourceItems.map((item) => [semanticIdentity(item), item]));
  const byIdentity = new Map();

  for (const item of Array.isArray(aiItems) ? aiItems : []) {
    const name = String(item?.name ?? "").trim();
    const value = String(item?.value ?? "").trim();
    const kind = String(item?.kind ?? "other").trim() || "other";
    if (!name || !value) continue;

    const normalizedItem = { kind, name, value, includes: mergeIncludes([], item?.includes) };
    const sourceEquivalent = sourceBySemantic.get(semanticIdentity(normalizedItem));
    if (sourceEquivalent && normalizeRateIdentity(sourceEquivalent.value) !== normalizeRateIdentity(value)) {
      continue;
    }
    byIdentity.set(fullIdentity(normalizedItem), normalizedItem);
  }

  for (const item of sourceItems) {
    const identity = fullIdentity(item);
    const existing = byIdentity.get(identity);
    if (existing) {
      existing.includes = mergeIncludes(existing.includes, item.includes);
    } else {
      byIdentity.set(identity, { ...item, includes: mergeIncludes([], item.includes) });
    }
  }

  const merged = [...byIdentity.values()];
  const packages = merged.filter((item) => item.kind === "common");
  return merged
    .filter((item) => item.kind === "common" || !packages.some((pkg) => packageContainsItem(pkg, item)))
    .slice(0, MAX_SERVICE_ITEMS);
}
