function normalizeRoomSummarySource(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ ]{2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatRoomSummarySource(value) {
  const source = normalizeRoomSummarySource(value);
  if (!source) return [];

  const blocks = [];
  for (const line of source.split("\n")) {
    if (!line) continue;

    const labeled = line.match(/^([^:：\n]{1,48})\s*[:：]\s*(.*)$/u);
    if (labeled) {
      const label = labeled[1].trim();
      const detail = labeled[2].trim();
      blocks.push(detail
        ? { type: "field", label, value: detail }
        : { type: "heading", label });
      continue;
    }

    const bullet = line.match(/^[+\-–—•·*]\s*(.+)$/u);
    if (bullet) {
      blocks.push({ type: "bullet", value: bullet[1].trim() });
      continue;
    }

    blocks.push({ type: "text", value: line });
  }
  return blocks;
}
