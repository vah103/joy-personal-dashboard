function normalizeBaseText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ");
}

export function normalizeText(value) {
  return normalizeBaseText(value).trim();
}

export function normalizeWhitespace(value) {
  return normalizeBaseText(value)
    .replace(/ *\n */g, "\n")
    .trim();
}

export function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

export function capitalizeFirst(value) {
  const text = String(value || "").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

export function lowerFirst(value) {
  const text = String(value || "").trim();
  return text ? text[0].toLowerCase() + text.slice(1) : "";
}
