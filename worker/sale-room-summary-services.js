import {
  MAX_SERVICE_ITEMS,
  clean,
  fold,
  phraseGrounded,
  sourceLines,
} from "./sale-room-summary-foundation.js";

const RATE_RE = /(?<![\p{L}\p{N}_])(?:(?:miễn\s+phí|mien\s+phi|free)|\d+(?:[.,]\d+)?(?:\s*(?:tr(?:iệu|ieu)?|m|k|nghìn|nghin|đ|d|vnd))?(?:(?:\s*\/\s*|\s+)(?:1\s*)?(?:ng|người|nguoi|phòng|phong|xe|tháng|thang|m3|m³|khối|khoi|số|so|kwh)))(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|m|k|nghìn|nghin|đ|d|vnd)(?![\p{L}\p{N}_])/giu;

function rateMatches(value) {
  return [...String(value ?? "").matchAll(new RegExp(RATE_RE.source, "giu"))].map((match) => ({
    raw: match[0].trim(),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function canonicalRate(value) {
  const raw = clean(value, 90);
  if (/^(?:miễn\s+phí|mien\s+phi|free)$/iu.test(raw)) return "miễn phí";
  const unitMatch = raw.match(/^(.*?)(?:\s*\/\s*|\s+)(?:1\s*)?(ng|người|nguoi|phòng|phong|xe|tháng|thang|m3|m³|khối|khoi|số|so|kwh)$/iu);
  if (!unitMatch) return raw.replace(/\s+/g, "");
  const amount = unitMatch[1].replace(/\s+/g, "");
  const unit = fold(unitMatch[2]);
  const units = {
    ng: "người", nguoi: "người",
    phong: "phòng",
    xe: "xe",
    thang: "tháng",
    m3: "khối", khoi: "khối",
    so: "số", kwh: "số",
  };
  return `${amount}/${units[unit] || unitMatch[2]}`;
}

function rateIdentity(value) {
  return fold(canonicalRate(value)).replace(/\s+/g, "");
}

function splitTopLevelService(lineValue) {
  const line = String(lineValue ?? "");
  const out = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    const decimalComma = ch === "," && /\d/u.test(line[i - 1] || "") && /\d/u.test(line[i + 1] || "");
    const decimalDot = ch === "." && /\d/u.test(line[i - 1] || "") && /\d/u.test(line[i + 1] || "");
    if (depth === 0 && !decimalComma && !decimalDot && (ch === "," || ch === ";" || ch === "|" || ch === "•" || ch === ".")) {
      const part = line.slice(start, i).trim();
      if (part) out.push(part);
      start = i + 1;
    }
  }
  const tail = line.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function serviceClauses(sourceValue) {
  const clauses = [];
  for (const line of sourceLines(sourceValue)) {
    if (!/(?<![\p{L}\p{N}_])(?:dịch\s*vụ|dich\s*vu|dvc|dv|phí|phi|điện|dien|nước|nuoc|mạng|mang|internet|wifi|vệ\s*sinh|ve\s*sinh|rác|rac|gửi\s*xe|gui\s*xe|để\s*xe|de\s*xe|máy\s*giặt|may\s*giat|camera|bảo\s*vệ|bao\s*ve)(?![\p{L}\p{N}_])/iu.test(line)) continue;
    const parts = splitTopLevelService(line);
    for (let index = 0; index < parts.length; index += 1) {
      let clause = parts[index];
      const canOwnContinuation = rateMatches(clause).length === 1
        && (hasCommonLabel(clause) || /(?:^|\s)(?:gom|bao gom)(?:\s|$)/u.test(` ${fold(clause)} `));
      if (canOwnContinuation) {
        while (
          index + 1 < parts.length
          && rateMatches(parts[index + 1]).length === 0
          && packageMembers(parts[index + 1]).length > 0
        ) {
          clause += `, ${parts[index + 1]}`;
          index += 1;
        }
      }
      clauses.push(clause);
    }
  }
  return clauses;
}

const MEMBER_ALIASES = Object.freeze([
  ["Mạng", /(?:^|\s)(?:mang|internet|wifi)(?:\s|$)/u],
  ["Vệ sinh", /(?:^|\s)(?:ve sinh|vs)(?:\s|$)/u],
  ["Rác", /(?:^|\s)(?:rac|rac thai)(?:\s|$)/u],
  ["Thang máy", /(?:^|\s)thang may(?:\s|$)/u],
  ["Máy giặt chung", /(?:^|\s)(?:may giat chung|may giat)(?:\s|$)/u],
  ["Gửi xe", /(?:^|\s)(?:gui xe|de xe|xe may|parking|phi xe)(?:\s|$)/u],
  ["Điện chung", /(?:^|\s)(?:dien chung|dien hanh lang)(?:\s|$)/u],
  ["Nước chung", /(?:^|\s)nuoc chung(?:\s|$)/u],
  ["Camera", /(?:^|\s)camera(?:\s|$)/u],
  ["Bảo vệ", /(?:^|\s)bao ve(?:\s|$)/u],
]);

function packageMembers(clauseValue) {
  const text = ` ${fold(clauseValue)} `;
  const out = [];
  for (const [name, pattern] of MEMBER_ALIASES) if (pattern.test(text)) out.push(name);
  return [...new Set(out)];
}

function hasCommonLabel(clauseValue) {
  return /(?:^|\s)(?:dich vu chung|dvc|dv chung|dv|phi chung|phi dich vu|phi dv|dich vu)(?:\s|$)/u.test(` ${fold(clauseValue)} `);
}

function hasElectricityLabel(value) { return /(?:^|\s)(?:electricity|dien(?!\s+(?:chung|hanh lang)))(?:\s|$)/u.test(` ${fold(value)} `); }
function hasWaterLabel(value) { return /(?:^|\s)(?:water|nuoc(?!\s+chung))(?:\s|$)/u.test(` ${fold(value)} `); }
function isSharedUtility(value) {
  const text = fold(value);
  return /(?:^|\s)dien\s*(?:va\s*)?nuoc(?:\s|$)/u.test(text) || /(?:^|\s)nuoc\s*(?:va\s*)?dien(?:\s|$)/u.test(text);
}
function rateUnit(value) {
  const match = canonicalRate(value).match(/\/([^/]+)$/u);
  return match ? fold(match[1]) : "";
}

function utilityLabelRanges(clauseValue, kind) {
  const pattern = kind === "electricity"
    ? /(?<![\p{L}\p{N}_])(?:electricity|điện(?!\s+(?:chung|hành\s+lang))|dien(?!\s+(?:chung|hanh\s+lang)))(?![\p{L}\p{N}_])/giu
    : /(?<![\p{L}\p{N}_])(?:water|nước(?!\s+chung)|nuoc(?!\s+chung))(?![\p{L}\p{N}_])/giu;
  return [...String(clauseValue ?? "").matchAll(pattern)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function rangeDistance(left, right) {
  if (left.end <= right.start) return right.start - left.end;
  if (right.end <= left.start) return left.start - right.end;
  return 0;
}

function rateBelongsToUtility(clause, rate, kind) {
  const target = utilityLabelRanges(clause, kind);
  const other = utilityLabelRanges(clause, kind === "electricity" ? "water" : "electricity");
  const unit = rateUnit(rate.raw);
  const inferred = kind === "electricity" ? unit === "so" : unit === "khoi";

  if (!target.length) return inferred;
  if (!other.length) return true;

  const targetDistance = Math.min(...target.map((position) => rangeDistance(rate, position)));
  const otherDistance = Math.min(...other.map((position) => rangeDistance(rate, position)));
  if (targetDistance === otherDistance) return inferred;
  return targetDistance < otherDistance;
}

function utilityCandidates(sourceValue, kind) {
  const values = [];
  for (const clause of serviceClauses(sourceValue)) {
    if (isSharedUtility(clause) && rateMatches(clause).length === 1) continue;
    for (const rate of rateMatches(clause)) {
      if (rateBelongsToUtility(clause, rate, kind)) values.push(canonicalRate(rate.raw));
    }
  }
  const unique = [...new Map(values.map((value) => [rateIdentity(value), value])).values()];
  return unique;
}

export function serviceRateIsGroundedInSource(sourceValue, serviceKind, rateValue) {
  const id = rateIdentity(rateValue);
  if (!id || !["electricity", "water"].includes(serviceKind)) return false;
  return utilityCandidates(sourceValue, serviceKind).some((value) => rateIdentity(value) === id);
}

export function normalizeDetectedServiceRate(sourceValue, serviceKind, value) {
  const candidate = clean(value, 90).replace(/^(?:điện|dien|electricity|nước|nuoc|water)\s*[:：-]?\s*/iu, "");
  if (!candidate || !serviceRateIsGroundedInSource(sourceValue, serviceKind, candidate)) return "";
  const id = rateIdentity(candidate);
  const grounded = utilityCandidates(sourceValue, serviceKind).find((rate) => rateIdentity(rate) === id);
  return grounded || "";
}

export function normalizeDetectedServices(sourceValue, electricityValue, waterValue) {
  return {
    electricity: normalizeDetectedServiceRate(sourceValue, "electricity", electricityValue),
    water: normalizeDetectedServiceRate(sourceValue, "water", waterValue),
  };
}

function serviceKindAndName(clauseValue) {
  const text = ` ${fold(clauseValue)} `;
  if (/(?:^|\s)(?:mang|internet|wifi)(?:\s|$)/u.test(text)) return ["internet", "Mạng"];
  if (/(?:^|\s)(?:gui xe|de xe|xe may|parking|phi xe)(?:\s|$)/u.test(text)) return ["parking", "Gửi xe"];
  if (/(?:^|\s)(?:may giat chung)(?:\s|$)/u.test(text)) return ["washing", "Máy giặt chung"];
  if (/(?:^|\s)(?:ve sinh|vs)(?:\s|$)/u.test(text)) return ["cleaning", "Vệ sinh"];
  if (/(?:^|\s)(?:rac|rac thai)(?:\s|$)/u.test(text)) return ["cleaning", "Rác"];
  return ["", ""];
}

function dedupeServiceItems(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.kind}|${fold(item.name)}|${rateIdentity(item.value)}`;
    const existing = map.get(key);
    if (!existing) map.set(key, { ...item, includes: [...new Set(item.includes || [])] });
    else existing.includes = [...new Set([...(existing.includes || []), ...(item.includes || [])])];
  }
  return [...map.values()];
}

function removePackageMembers(items) {
  const packages = items.filter((item) => item.kind === "common");
  return items.filter((item) => item.kind === "common" || !packages.some((pkg) => (
    pkg.includes.some((name) => fold(name) === fold(item.name))
    && rateIdentity(pkg.value) === rateIdentity(item.value)
  )));
}

export function extractSourceDynamicServiceItems(sourceValue) {
  const items = [];
  for (const clause of serviceClauses(sourceValue)) {
    const rates = rateMatches(clause);
    if (!rates.length) continue;
    const members = packageMembers(clause);
    const common = hasCommonLabel(clause);
    const shared = isSharedUtility(clause);

    if (shared && rates.length === 1) {
      items.push({ kind: "other", name: "Điện + nước", value: canonicalRate(rates[0].raw), includes: [] });
      continue;
    }

    const dedicatedElectric = hasElectricityLabel(clause) || rates.some((rate) => rateUnit(rate.raw) === "so");
    const dedicatedWater = hasWaterLabel(clause) || rates.some((rate) => rateUnit(rate.raw) === "khoi");

    if (rates.length === 1 && members.length >= 2 && !shared) {
      const bundleCue = common || /[+&()]/u.test(clause) || /(?:^|\s)(?:gom|bao gom|va|voi)(?:\s|$)/u.test(` ${fold(clause)} `);
      if (bundleCue) {
        items.push({ kind: "common", name: "Dịch vụ chung", value: canonicalRate(rates[0].raw), includes: members });
        continue;
      }
    }

    if (common && rates.length === 1 && !dedicatedElectric && !dedicatedWater) {
      items.push({ kind: "common", name: "Dịch vụ chung", value: canonicalRate(rates[0].raw), includes: members });
      continue;
    }

    const [kind, name] = serviceKindAndName(clause);
    if (kind && rates.length === 1) {
      items.push({ kind, name, value: canonicalRate(rates[0].raw), includes: [] });
    }
  }
  return removePackageMembers(dedupeServiceItems(items)).slice(0, MAX_SERVICE_ITEMS);
}

function canonicalInclude(value) {
  const key = fold(value);
  for (const [name, pattern] of MEMBER_ALIASES) if (pattern.test(` ${key} `)) return name;
  const cleanValue = clean(value, 90);
  return cleanValue ? cleanValue.charAt(0).toLocaleUpperCase("vi") + cleanValue.slice(1) : "";
}

export function serviceEvidenceIsGroundedInSource(sourceValue, evidenceValue) {
  return phraseGrounded(sourceValue, evidenceValue);
}

function canonicalAiService(kindValue, nameValue) {
  const nameKey = fold(nameValue);
  if (kindValue === "common" || /(?:^|\s)(?:dich vu chung|dvc|dv chung|phi chung)(?:\s|$)/u.test(` ${nameKey} `)) return ["common", "Dịch vụ chung"];
  if (/(?:^|\s)(?:mang|internet|wifi)(?:\s|$)/u.test(` ${nameKey} `)) return ["internet", "Mạng"];
  if (/(?:^|\s)(?:gui xe|de xe|xe may|parking|phi xe)(?:\s|$)/u.test(` ${nameKey} `)) return ["parking", "Gửi xe"];
  if (/(?:^|\s)(?:may giat|giat chung)(?:\s|$)/u.test(` ${nameKey} `)) return ["washing", "Máy giặt chung"];
  if (/(?:^|\s)(?:ve sinh|vs)(?:\s|$)/u.test(` ${nameKey} `)) return ["cleaning", "Vệ sinh"];
  if (/(?:^|\s)(?:rac|rac thai)(?:\s|$)/u.test(` ${nameKey} `)) return ["cleaning", "Rác"];
  if (/^(?:dien nuoc|nuoc dien)$/u.test(nameKey)) return ["other", "Điện + nước"];
  return ["other", clean(nameValue, 90)];
}

export function normalizeDynamicServiceItems(sourceValue, itemValues) {
  if (!Array.isArray(itemValues)) return [];
  const out = [];
  for (const raw of itemValues.slice(0, MAX_SERVICE_ITEMS)) {
    const evidence = clean(raw?.evidence, 420);
    if (!evidence || !serviceEvidenceIsGroundedInSource(sourceValue, evidence)) continue;
    const evidenceRates = rateMatches(evidence);
    const wanted = rateIdentity(raw?.value);
    const groundedRate = evidenceRates.find((rate) => rateIdentity(rate.raw) === wanted);
    if (!groundedRate) continue;

    const [kind, name] = canonicalAiService(String(raw?.kind || "").toLowerCase(), raw?.name);
    if (!name) continue;
    const nameKey = fold(name);
    if (/^(?:dien|nuoc|electricity|water)$/u.test(nameKey)) continue;

    const includes = kind === "common"
      ? [...new Set((Array.isArray(raw?.includes) ? raw.includes : [])
        .map(canonicalInclude)
        .filter((value) => value && phraseGrounded(evidence, value)))]
      : [];

    if (kind === "common") {
      if (!hasCommonLabel(evidence) && includes.length < 2) continue;
    } else if (kind !== "other") {
      if (!phraseGrounded(evidence, raw?.name) && !phraseGrounded(evidence, name)) continue;
    } else if (name === "Điện + nước") {
      if (!isSharedUtility(evidence)) continue;
    } else if (!phraseGrounded(evidence, name)) {
      continue;
    }

    out.push({ kind, name, value: canonicalRate(groundedRate.raw), includes });
  }
  return removePackageMembers(dedupeServiceItems(out)).slice(0, MAX_SERVICE_ITEMS);
}

export function reconcileDynamicServiceItems(sourceValue, aiItems) {
  const sourceItems = extractSourceDynamicServiceItems(sourceValue);
  const sourceMap = new Map(sourceItems.map((item) => [`${item.kind}|${fold(item.name)}`, item]));
  const merged = [...sourceItems];
  for (const item of Array.isArray(aiItems) ? aiItems : []) {
    const key = `${String(item?.kind || "other")}|${fold(item?.name)}`;
    if (sourceMap.has(key)) continue;
    const value = canonicalRate(item?.value);
    if (!item?.name || !value || !phraseGrounded(sourceValue, item.name) || !rateMatches(sourceValue).some((rate) => rateIdentity(rate.raw) === rateIdentity(value))) continue;
    merged.push({ kind: item.kind || "other", name: item.name, value, includes: Array.isArray(item.includes) ? item.includes : [] });
  }
  return removePackageMembers(dedupeServiceItems(merged)).slice(0, MAX_SERVICE_ITEMS);
}

export function reconcileUtilityServiceFields(serviceFields = {}, serviceItems = []) {
  const shared = new Set((serviceItems || [])
    .filter((item) => fold(item?.name) === "dien nuoc")
    .map((item) => rateIdentity(item?.value)));
  const electricity = String(serviceFields?.electricity || "").trim();
  const water = String(serviceFields?.water || "").trim();
  return {
    electricity: shared.has(rateIdentity(electricity)) ? "" : electricity,
    water: shared.has(rateIdentity(water)) ? "" : water,
    items: Array.isArray(serviceItems) ? serviceItems : [],
  };
}

export function extractSourceUtilityServices(sourceValue) {
  const electricity = utilityCandidates(sourceValue, "electricity");
  const water = utilityCandidates(sourceValue, "water");
  return {
    electricity: electricity.length === 1 ? electricity[0] : "",
    water: water.length === 1 ? water[0] : "",
  };
}

export function serviceFactsNeedAssist(sourceValue, services = {}) {
  const represented = new Set([
    services.electricity,
    services.water,
    ...(Array.isArray(services.items) ? services.items.map((item) => item.value) : []),
  ].map(rateIdentity).filter(Boolean));
  for (const clause of serviceClauses(sourceValue)) {
    for (const rate of rateMatches(clause)) {
      if (!represented.has(rateIdentity(rate.raw))) return true;
    }
  }
  return false;
}
