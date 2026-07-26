const VIETNAM_UTC_OFFSET_HOURS = 7;

export function parseSheetViewingTime(value) {
  const match = String(value || "").trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/,
  );
  if (!match) return null;

  const [, dayText, monthText, yearText, hourText, minuteText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (
    year < 2000
    || month < 1 || month > 12
    || day < 1 || day > 31
    || hour < 0 || hour > 23
    || minute < 0 || minute > 59
  ) return null;

  const utc = Date.UTC(year, month - 1, day, hour - VIETNAM_UTC_OFFSET_HOURS, minute);
  const vietnamTime = new Date(utc + VIETNAM_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  if (
    vietnamTime.getUTCFullYear() !== year
    || vietnamTime.getUTCMonth() !== month - 1
    || vietnamTime.getUTCDate() !== day
    || vietnamTime.getUTCHours() !== hour
    || vietnamTime.getUTCMinutes() !== minute
  ) return null;
  return utc;
}

export function normalizeUpcomingViewings(rows, now = Date.now()) {
  return (Array.isArray(rows) ? rows : []).flatMap((row, index) => {
    if (!Array.isArray(row)) return [];
    const [customerName, phone, viewingAddress, viewingTime, beforeStatus, afterStatus] = row;
    const viewingAt = parseSheetViewingTime(viewingTime);
    if (!customerName || !viewingAddress || viewingAt === null || viewingAt < now) return [];

    return [{
      sourceRow: index + 2,
      customerName: String(customerName).trim(),
      phone: String(phone || "").trim(),
      viewingAddress: String(viewingAddress).trim(),
      viewingTime: String(viewingTime).trim(),
      viewingAt: new Date(viewingAt).toISOString(),
      beforeStatus: String(beforeStatus || "").trim(),
      afterStatus: String(afterStatus || "").trim(),
    }];
  });
}
