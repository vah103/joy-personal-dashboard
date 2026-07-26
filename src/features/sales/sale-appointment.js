const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function vietnamParts(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour") % 24,
    minute: value("minute"),
  };
}

function vietnamTimestamp({ year, month, day, hour, minute }) {
  return Date.UTC(year, month - 1, day, hour, minute) - VIETNAM_OFFSET_MS;
}

function addVietnamDays(parts, days) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    ...parts,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function validVietnamDate(parts) {
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return probe.getUTCFullYear() === parts.year
    && probe.getUTCMonth() === parts.month - 1
    && probe.getUTCDate() === parts.day;
}

function parseRelativeTime(text, now) {
  const relative = text.match(/\b(\d{1,4})\s*(p|ph|phút|phut|m|min|h|giờ|gio|tiếng|tieng)\s*(?:nữa|nua|sau)\b/iu);
  if (!relative) return null;
  const amount = Number(relative[1]);
  const unit = normalizeSearch(relative[2]);
  const milliseconds = ["h", "gio", "tieng"].includes(unit)
    ? amount * 60 * 60 * 1000
    : amount * 60 * 1000;
  return {
    timestamp: now + milliseconds,
    matchedText: relative[0],
    source: "relative",
  };
}

function applyPeriod(hourValue, periodValue) {
  let hour = Number(hourValue);
  const period = normalizeSearch(periodValue || "");
  if (["chieu", "toi", "dem"].includes(period) && hour < 12) hour += 12;
  if (period === "trua" && hour < 11) hour += 12;
  if (period === "sang" && hour === 12) hour = 0;
  return hour;
}

function parseClock(text, fallback) {
  const nowPhrase = text.match(/\b(?:giờ\s+(?:khách|bạn)\s+qua|gio\s+(?:khach|ban)\s+qua|ngay\s+bây\s+giờ|ngay\s+bay\s+gio|bây\s+giờ|bay\s+gio|hiện\s+tại|hien\s+tai)\b/iu);
  if (nowPhrase) return { hour: fallback.hour, minute: fallback.minute, matchedText: nowPhrase[0], isNow: true };

  const marked = text.match(/\b(\d{1,2})\s*(?:h|giờ|gio|:)\s*(\d{1,2})?\s*(sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem)?\b/iu);
  const dotted = marked ? null : text.match(/\b(\d{1,2})\.(\d{2})\s*(sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem)?\b/iu);
  const periodOnly = marked || dotted ? null : text.match(/\b(\d{1,2})\s*(sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem)\b/iu);
  const clock = marked || dotted || periodOnly;
  if (clock) {
    const minute = periodOnly ? 0 : Number(clock[2] || 0);
    const period = periodOnly ? clock[2] : clock[3] || "";
    const hour = applyPeriod(clock[1], period);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute, matchedText: clock[0], isNow: false };
  }

  const daypart = text.match(/\b(sáng|sang|trưa|trua|chiều|chieu|tối|toi)\b/iu);
  if (!daypart) return null;
  const defaults = { sang: 9, trua: 12, chieu: 15, toi: 20 };
  return {
    hour: defaults[normalizeSearch(daypart[1])],
    minute: 0,
    matchedText: daypart[0],
    isNow: false,
  };
}

function parseDate(text, fallback) {
  const explicit = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/u);
  if (explicit) {
    let year = explicit[3] ? Number(explicit[3]) : fallback.year;
    if (year < 100) year += 2000;
    const parts = { year, month: Number(explicit[2]), day: Number(explicit[1]) };
    if (validVietnamDate(parts)) return { ...parts, matchedText: explicit[0] };
  }

  const dayAfterTomorrow = text.match(/\b(?:ngày\s+kia|ngay\s+kia|mốt|mot)\b/iu);
  if (dayAfterTomorrow) return { ...addVietnamDays(fallback, 2), matchedText: dayAfterTomorrow[0] };
  const tomorrow = text.match(/\b(?:ngày\s+mai|ngay\s+mai|mai)\b/iu);
  if (tomorrow) return { ...addVietnamDays(fallback, 1), matchedText: tomorrow[0] };
  const today = text.match(/\b(?:hôm\s+nay|hom\s+nay|nay)\b/iu);
  if (today) return { ...fallback, matchedText: today[0] };
  return { ...fallback, matchedText: "" };
}

function parseViewingTime(text, now) {
  const relative = parseRelativeTime(text, now);
  if (relative) return relative;

  const fallback = vietnamParts(now);
  const clock = parseClock(text, fallback);
  if (!clock) return null;
  if (clock.isNow) return { timestamp: now, matchedText: clock.matchedText, source: "now" };

  const date = parseDate(text, fallback);
  let timestamp = vietnamTimestamp({
    year: date.year,
    month: date.month,
    day: date.day,
    hour: clock.hour,
    minute: clock.minute,
  });
  if (!date.matchedText && timestamp < now - 5 * 60 * 1000) {
    const tomorrow = addVietnamDays(date, 1);
    timestamp = vietnamTimestamp({ ...tomorrow, hour: clock.hour, minute: clock.minute });
  }
  return {
    timestamp,
    matchedText: [clock.matchedText, date.matchedText].filter(Boolean).join(" "),
    source: "clock",
  };
}

function extractPhone(text) {
  const match = text.match(/(?:\+?84|0)(?:[\s.\-]?\d){8,10}/u);
  if (!match) return { phone: "", matchedText: "" };
  return {
    phone: match[0].replace(/[\s.\-]/g, "").replace(/^\+84/, "0"),
    matchedText: match[0],
  };
}

function cleanAddress(value) {
  return String(value || "")
    .replace(/^(?:xem\s*(?:phòng|phong))\s*/iu, "")
    .replace(/\s+(?:ạ|a)$/iu, "")
    .trim()
    .replace(/[.!?]+$/g, "");
}

function extractAddress(text) {
  const patterns = [
    /(?:giờ\s+(?:khách|bạn)\s+qua|gio\s+(?:khach|ban)\s+qua)\s*(?:xem\s*(?:phòng|phong))?\s*(?:tại|tai|ở|o)?\s*([^,;\n]+)$/iu,
    /xem\s*(?:phòng|phong)?\s*(?:tại|tai|ở|o)?\s*([^,;\n]+)$/iu,
    /(?:hẹn|hen)\s*(?:xem\s*(?:phòng|phong))?\s*(?:tại|tai|ở|o)?\s*([^,;\n]+)$/iu,
    /(?:địa\s*chỉ|dia\s*chi|đc|dc|tại|tai|ở|o)\s*[:\-]?\s*([^,;\n]+)$/iu,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return { address: cleanAddress(match[1]), matchedText: match[0] };
  }
  return { address: "", matchedText: "" };
}

function cleanCustomerName(text, removals) {
  let value = text;
  for (const removal of removals.filter(Boolean).sort((a, b) => b.length - a.length)) {
    value = value.replace(removal, " ");
  }
  value = value
    .replace(/\b(?:hẹn|hen|đặt\s+lịch|dat\s+lich|lịch\s+xem|lich\s+xem|xem\s+phòng|xem\s+phong|khách|khach|qua|tại|tai|ở|o)\b/giu, " ")
    .replace(/[,:;|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const prefixMatch = value.match(/\b(?:anh|chị|chi|cô|co|chú|chu|bác|bac|em|bạn|ban)\s+[\p{L}][\p{L}\s.'-]{0,60}/iu);
  if (prefixMatch) return prefixMatch[0].trim();
  return value.split(/\s{2,}|\n/)[0].trim().slice(0, 80);
}

export function parseSaleAppointmentInput(rawInput, now = Date.now()) {
  const text = normalizeText(rawInput);
  const phone = extractPhone(text);
  const viewingTime = parseViewingTime(text, now);
  const address = extractAddress(text);
  const detectedName = cleanCustomerName(text, [
    phone.matchedText,
    viewingTime?.matchedText || "",
    address.matchedText,
    address.address,
  ]);
  const customerName = detectedName
    || (phone.phone ? `Khách ${phone.phone}` : address.address ? `Khách xem phòng ${address.address}` : "");

  const result = {
    customerName,
    phone: phone.phone,
    viewingAddress: address.address,
    viewingAt: viewingTime ? new Date(viewingTime.timestamp).toISOString() : "",
  };
  const missing = [];
  if (!result.viewingAddress) missing.push("viewingAddress");
  if (!result.viewingAt) missing.push("viewingAt");
  return { ...result, missing, valid: missing.length === 0 };
}

export function formatVietnamViewingTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "—";
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("weekday")}, ${part("day")}/${part("month")}/${part("year")} · ${part("hour")}:${part("minute")}`;
}
