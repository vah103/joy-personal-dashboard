const MAX_SERVICE_ITEMS = 16;
const MAX_SERVICE_NAME_LENGTH = 90;
const MAX_SERVICE_VALUE_LENGTH = 90;
const MAX_SERVICE_EVIDENCE_LENGTH = 420;
const MAX_SERVICE_INCLUDES = 12;

const SERVICE_KINDS = new Set(["common", "internet", "parking", "cleaning", "washing", "other"]);
const RATE_SOURCE = String.raw`(?:\d+(?:[.,]\d+)?\s*(?:tr(?:iệu|ieu)?|m|k|nghìn|nghin|đ|d|vnd)\s*\d*(?:\s*\/\s*(?:1\s*)?(?:ng|người|nguoi|phòng|phong|xe|tháng|thang|m3|m³|khối|khoi|số|so|kwh))?|\d+(?:[.,]\d+)?\s*\/\s*(?:1\s*)?(?:ng|người|nguoi|phòng|phong|xe|tháng|thang|m3|m³|khối|khoi|số|so|kwh)|(?:miễn\s+phí|mien\s+phi|free))`;

const SERVICE_ITEMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: {
            type: "string",
            enum: ["common", "internet", "parking", "cleaning", "washing", "other"],
          },
          name: { type: "string" },
          value: { type: "string" },
          includes: {
            type: "array",
            items: { type: "string" },
          },
          evidence: { type: "string" },
        },
        required: ["kind", "name", "value", "includes", "evidence"],
      },
    },
  },
  required: ["items"],
};

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

function cleanField(value, maxLength) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’•·*☘🌷🏢⌛⭐🏆-]+/u, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim()
    .slice(0, maxLength);
}

function cleanEvidence(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim()
    .slice(0, MAX_SERVICE_EVIDENCE_LENGTH);
}

function unicodeCue(source) {
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`, "giu");
}

function ratePattern(flags = "giu") {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${RATE_SOURCE}(?![\\p{L}\\p{N}_])`, flags);
}

function normalizeRateSignature(value) {
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

function rateMatches(value) {
  return [...String(value ?? "").matchAll(ratePattern())].map((match) => ({
    value: match[0],
    signature: normalizeRateSignature(match[0]),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function formatDynamicServiceValue(value) {
  return cleanField(value, MAX_SERVICE_VALUE_LENGTH)
    .replace(/\s*\/\s*/g, "/")
    .replace(/\bK\b/g, "k")
    .replace(/\/(?:1\s*)?(?:ng|người|nguoi)$/iu, "/người")
    .replace(/\/(?:1\s*)?(?:m3|m³|khối|khoi)$/iu, "/khối")
    .replace(/\/(?:1\s*)?(?:phòng|phong)$/iu, "/phòng")
    .replace(/\/(?:1\s*)?xe$/iu, "/xe")
    .replace(/\/(?:1\s*)?(?:tháng|thang)$/iu, "/tháng")
    .replace(/\/(?:1\s*)?(?:số|so|kwh)$/iu, "/số");
}

function inferServiceKind(kindValue, nameValue) {
  const requested = String(kindValue ?? "").trim().toLowerCase();
  const name = normalizeComparable(nameValue);

  if (/(?:^|\s)(?:dich vu chung|dv chung|phi chung|phi dich vu chung|phi dv chung)(?:\s|$)/u.test(name)) return "common";
  if (/(?:^|\s)(?:mang|internet|wifi)(?:\s|$)/u.test(name)) return "internet";
  if (/(?:^|\s)(?:gui xe|xe may|parking|phi xe)(?:\s|$)/u.test(name)) return "parking";
  if (/(?:^|\s)(?:ve sinh|rac)(?:\s|$)/u.test(name)) return "cleaning";
  if (/(?:^|\s)(?:may giat|giat chung)(?:\s|$)/u.test(name)) return "washing";
  return SERVICE_KINDS.has(requested) ? requested : "other";
}

function canonicalServiceName(kind, nameValue) {
  const name = cleanField(nameValue, MAX_SERVICE_NAME_LENGTH);
  const comparable = normalizeComparable(name);

  if (kind === "common") return "Dịch vụ chung";
  if (kind === "internet") return "Mạng";
  if (kind === "parking") return "Gửi xe";
  if (kind === "washing") return "Máy giặt chung";
  if (kind === "cleaning") return /(?:^|\s)rac(?:\s|$)/u.test(comparable) && !/(?:^|\s)ve sinh(?:\s|$)/u.test(comparable)
    ? "Rác"
    : "Vệ sinh";
  if (comparable === "dien nuoc" || comparable === "nuoc dien") return "Điện + nước";

  if (!name) return "";
  return name.charAt(0).toLocaleUpperCase("vi") + name.slice(1);
}

function canonicalIncludedService(value) {
  const clean = cleanField(value, MAX_SERVICE_NAME_LENGTH);
  const comparable = normalizeComparable(clean);
  if (!clean || !comparable) return "";

  if (/^(?:mang|internet|wifi)$/u.test(comparable)) return "Mạng";
  if (/^(?:ve sinh|vs)$/u.test(comparable)) return "Vệ sinh";
  if (/^(?:rac|rac thai)$/u.test(comparable)) return "Rác";
  if (/^(?:may giat|may giat chung|giat chung)$/u.test(comparable)) return "Máy giặt chung";
  if (/^(?:gui xe|xe may|parking|phi xe)$/u.test(comparable)) return "Gửi xe";
  if (/^(?:dien chung|dien hanh lang)$/u.test(comparable)) return "Điện chung";
  if (/^(?:nuoc chung)$/u.test(comparable)) return "Nước chung";
  if (/^dien$/u.test(comparable)) return "Điện";
  if (/^nuoc$/u.test(comparable)) return "Nước";
  if (/^(?:camera)$/u.test(comparable)) return "Camera";
  if (/^(?:bao ve)$/u.test(comparable)) return "Bảo vệ";

  return clean.charAt(0).toLocaleUpperCase("vi") + clean.slice(1);
}

function escapedPattern(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function targetCuePatterns(kind, name) {
  const comparable = normalizeComparable(name);
  if (kind === "common") {
    return [
      unicodeCue(String.raw`(?:dịch\s+vụ\s+chung|dv\s+chung|phí\s+chung|phí\s+(?:dịch\s+vụ|dv)\s+chung)`),
      unicodeCue(String.raw`(?:dịch\s+vụ|dv|phí\s+dịch\s+vụ|phí\s+dv)`),
    ];
  }
  if (kind === "internet") return [unicodeCue(String.raw`(?:mạng|internet|wifi)`)];
  if (kind === "parking") return [unicodeCue(String.raw`(?:gửi\s+xe|xe\s+máy|parking|phí\s+xe)`)];
  if (kind === "washing") return [unicodeCue(String.raw`(?:máy\s+giặt(?:\s+chung)?|giặt\s+chung)`)];
  if (kind === "cleaning") {
    return comparable === "rac"
      ? [unicodeCue(String.raw`rác`)]
      : [unicodeCue(String.raw`(?:vệ\s+sinh|vs)`)];
  }
  if (comparable === "dien nuoc" || comparable === "nuoc dien") {
    return [unicodeCue(String.raw`(?:điện\s*(?:\+|&|và)?\s*nước|nước\s*(?:\+|&|và)?\s*điện)`)];
  }

  const literal = cleanField(name, MAX_SERVICE_NAME_LENGTH);
  return literal ? [unicodeCue(escapedPattern(literal))] : [];
}

const KNOWN_SERVICE_CUE_PATTERNS = Object.freeze([
  unicodeCue(String.raw`(?:dịch\s+vụ\s+chung|dv\s+chung|phí\s+chung|phí\s+(?:dịch\s+vụ|dv)\s+chung)`),
  unicodeCue(String.raw`(?:mạng|internet|wifi)`),
  unicodeCue(String.raw`(?:gửi\s+xe|xe\s+máy|parking|phí\s+xe)`),
  unicodeCue(String.raw`(?:vệ\s+sinh|vs|rác)`),
  unicodeCue(String.raw`(?:máy\s+giặt(?:\s+chung)?|giặt\s+chung)`),
  unicodeCue(String.raw`(?:điện|electricity)`),
  unicodeCue(String.raw`(?:nước|water)`),
]);

function patternPositions(text, patterns) {
  const positions = [];
  for (const sourcePattern of patterns) {
    const flags = sourcePattern.flags.includes("g") ? sourcePattern.flags : `${sourcePattern.flags}g`;
    const pattern = new RegExp(sourcePattern.source, flags);
    for (const match of String(text ?? "").matchAll(pattern)) {
      positions.push({
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      });
    }
  }
  return positions;
}

function rangeDistance(left, right) {
  if (left.end < right.start) return right.start - left.end;
  if (right.end < left.start) return left.start - right.end;
  return 0;
}

function rateIsAssociatedWithService(evidence, kind, name, value) {
  const signature = normalizeRateSignature(value);
  if (!signature) return false;

  const candidateRates = rateMatches(evidence).filter((rate) => rate.signature === signature);
  if (!candidateRates.length) return false;

  const targetPositions = patternPositions(evidence, targetCuePatterns(kind, name));
  if (!targetPositions.length) return false;

  const otherPositions = patternPositions(evidence, KNOWN_SERVICE_CUE_PATTERNS)
    .filter((position) => !targetPositions.some((target) => rangeDistance(position, target) === 0));

  return candidateRates.some((rate) => {
    const targetDistance = Math.min(...targetPositions.map((target) => rangeDistance(rate, target)));
    if (!otherPositions.length) return true;
    const otherDistance = Math.min(...otherPositions.map((other) => rangeDistance(rate, other)));
    return targetDistance < otherDistance;
  });
}

export function serviceEvidenceIsGroundedInSource(sourceValue, evidenceValue) {
  const source = normalizeComparable(sourceValue);
  const evidence = normalizeComparable(evidenceValue);
  if (!source || !evidence || evidence.length < 3) return false;
  return (` ${source} `).includes(` ${evidence} `);
}

function includedServiceIsGroundedInEvidence(evidenceValue, includeValue) {
  const evidence = normalizeComparable(evidenceValue);
  const include = normalizeComparable(includeValue);
  if (!evidence || !include) return false;

  const aliases = new Map([
    ["mang", ["mang", "internet", "wifi"]],
    ["ve sinh", ["ve sinh", "vs"]],
    ["rac", ["rac", "rac thai"]],
    ["may giat chung", ["may giat", "may giat chung", "giat chung"]],
    ["gui xe", ["gui xe", "xe may", "parking", "phi xe"]],
    ["dien chung", ["dien chung", "dien hanh lang"]],
    ["nuoc chung", ["nuoc chung"]],
    ["dien", ["dien"]],
    ["nuoc", ["nuoc"]],
    ["camera", ["camera"]],
    ["bao ve", ["bao ve"]],
  ]);

  const candidates = aliases.get(include) || [include];
  return candidates.some((candidate) => (` ${evidence} `).includes(` ${candidate} `));
}

function itemIsStandaloneElectricityOrWater(kind, name) {
  if (["common", "internet", "parking", "cleaning", "washing"].includes(kind)) return false;
  const comparable = normalizeComparable(name);
  return /^(?:dien|dien sinh hoat|electricity|nuoc|water)$/u.test(comparable);
}

function packageIncludesIdentity(item, other) {
  if (item.kind !== "common") return false;
  const otherName = normalizeComparable(other.name);
  return item.includes.some((include) => normalizeComparable(include) === otherName);
}

function removePackageMemberDuplicates(items) {
  const packages = items.filter((item) => item.kind === "common");
  return items.filter((item) => {
    if (item.kind === "common") return true;
    return !packages.some((pkg) => (
      packageIncludesIdentity(pkg, item)
      && normalizeRateSignature(pkg.value) === normalizeRateSignature(item.value)
      && normalizeComparable(pkg._evidence) === normalizeComparable(item._evidence)
    ));
  });
}

export function normalizeDynamicServiceItems(sourceValue, itemValues) {
  if (!Array.isArray(itemValues)) return [];

  const normalized = [];
  const seen = new Set();

  for (const raw of itemValues.slice(0, MAX_SERVICE_ITEMS)) {
    const evidence = cleanEvidence(raw?.evidence);
    const rawName = cleanField(raw?.name, MAX_SERVICE_NAME_LENGTH);
    const kind = inferServiceKind(raw?.kind, rawName);
    const name = canonicalServiceName(kind, rawName);
    const rawValue = cleanField(raw?.value, MAX_SERVICE_VALUE_LENGTH);
    const value = formatDynamicServiceValue(rawValue);

    if (!name || !value || !evidence) continue;
    if (!serviceEvidenceIsGroundedInSource(sourceValue, evidence)) continue;
    if (!rateMatches(evidence).some((rate) => rate.signature === normalizeRateSignature(rawValue))) continue;
    if (!rateIsAssociatedWithService(evidence, kind, rawName || name, rawValue)) continue;
    if (itemIsStandaloneElectricityOrWater(kind, name)) continue;

    const includes = kind === "common"
      ? [...new Set((Array.isArray(raw?.includes) ? raw.includes : [])
        .slice(0, MAX_SERVICE_INCLUDES)
        .map(canonicalIncludedService)
        .filter((include) => include && includedServiceIsGroundedInEvidence(evidence, include)))]
      : [];

    const identity = `${kind}|${normalizeComparable(name)}|${normalizeRateSignature(value)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    normalized.push({ kind, name, value, includes, _evidence: evidence });
  }

  return removePackageMemberDuplicates(normalized).map(({ _evidence, ...item }) => item);
}

export function shouldExtractDynamicServices(sourceValue) {
  const source = normalizeComparable(sourceValue);
  if (!source) return false;
  return /(?:^|\s)(?:dich vu|dv|phi|mang|internet|wifi|ve sinh|rac|may giat|giat chung|gui xe|xe may|parking|phi quan ly|bao ve|camera|the thang may|dien nuoc)(?:\s|$)/u.test(source);
}

function extractAiObject(result) {
  if (result?.response && typeof result.response === "object" && !Array.isArray(result.response)) {
    return result.response;
  }

  const raw = typeof result?.response === "string"
    ? result.response
    : typeof result === "string"
      ? result
      : "";
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function serviceItemInstructions() {
  return `Bạn là bộ trích xuất NGỮ NGHĨA các khoản dịch vụ trong tin phòng trọ/căn hộ tiếng Việt.

Chỉ xử lý các dịch vụ NGOÀI tiền điện và tiền nước độc lập. Điện/nước độc lập đã có bộ trích xuất riêng. Trường hợp một mức phí DUY NHẤT áp chung cho cả điện và nước (ví dụ "điện nước 100k/ng") phải trả một item kind="other", name="Điện + nước", value là mức phí chung; không được gán mức đó riêng cho electricity hoặc water.

Trả đúng JSON:
{
  "items": [
    {
      "kind": "common | internet | parking | cleaning | washing | other",
      "name": "...",
      "value": "...",
      "includes": ["..."],
      "evidence": "..."
    }
  ]
}

NGUYÊN TẮC:
- Chỉ lấy khoản dịch vụ có mức phí/giá hoặc trạng thái miễn phí được ghi rõ trong nguồn. Không suy đoán.
- value phải giữ nguyên cách nguồn viết, ví dụ 180k/ng, 100k/phòng, 100k/xe, 50k/tháng, miễn phí. Không tự đổi đơn vị.
- evidence phải là một đoạn NGUYÊN VĂN, liên tục và ngắn từ nguồn, đủ để chứng minh đúng dịch vụ + đúng value + quan hệ gói nếu có. Không tự viết lại evidence.
- Nếu không chắc value thuộc dịch vụ nào thì bỏ item đó.
- Có thể hiểu cả dạng "nhãn -> giá" và "giá -> nhãn" khi quan hệ rõ, ví dụ "Mạng 100k/phòng" và "100k/phòng mạng".

PHÂN BIỆT GÓI VÀ KHOẢN RIÊNG:
- Nếu một mức phí bao trùm nhiều dịch vụ, trả MỘT item kind="common", name="Dịch vụ chung", value là mức phí của cả gói, includes là các thành phần.
- Ví dụ: "DV chung 180k/ng (vệ sinh, rác, mạng, điện chung, máy giặt)" => một item common 180k/ng, includes gồm các thành phần. TUYỆT ĐỐI không gán 180k/ng riêng cho mạng/vệ sinh/máy giặt.
- Cách viết "DV 180k/ng gồm ...", "phí chung ...", "phí dịch vụ chung ...", hoặc "mạng + vệ sinh + máy giặt 180k/ng" được hiểu theo cùng nguyên tắc nếu scope rõ và chỉ có một mức phí cho cả nhóm.
- Nếu từng dịch vụ có giá riêng, trả từng item riêng.
- Nếu vừa có gói chung vừa có khoản riêng, giữ cả hai.
- Nếu một thành phần trong gói còn có một mức phí riêng rõ ràng ở chỗ khác, mức riêng đó là item độc lập và không dùng mức phí gói cho nó.

KIND:
- common: gói dịch vụ/phí chung có một mức phí bao trùm nhiều thành phần.
- internet: mạng/internet/wifi có mức riêng.
- parking: gửi xe/xe máy có mức riêng.
- cleaning: vệ sinh hoặc rác có mức riêng.
- washing: máy giặt chung/giặt chung có mức riêng.
- other: bất kỳ khoản dịch vụ có phí nào khác như phí quản lý, thẻ thang máy, bảo vệ, hoặc phí điện+nước gộp.

NAME:
- Có thể chuẩn hóa tên quen thuộc thành "Dịch vụ chung", "Mạng", "Gửi xe", "Vệ sinh", "Rác", "Máy giặt chung", "Điện + nước".
- Với kind=other, dùng tên ngắn gọn đúng ý nguồn; không phát minh dịch vụ mới.

Nếu nguồn chỉ có điện/nước độc lập hoặc không có dịch vụ còn lại có phí rõ ràng, trả items=[].`;
}

export async function extractDynamicServiceItems(sourceValue, env, model) {
  if (!shouldExtractDynamicServices(sourceValue) || !env?.AI?.run || !model) return [];

  try {
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: serviceItemInstructions() },
        { role: "user", content: String(sourceValue ?? "") },
      ],
      response_format: {
        type: "json_schema",
        json_schema: SERVICE_ITEMS_SCHEMA,
      },
      temperature: 0,
      max_tokens: 900,
    });

    const detected = extractAiObject(result) || {};
    return normalizeDynamicServiceItems(sourceValue, detected.items);
  } catch (error) {
    console.warn("Joy Sale dynamic service extraction unavailable", error?.message || error);
    return [];
  }
}
