const STRING_LITERAL = String.raw`(?:(?:"((?:\\.|[^"\\\n])*)")|(?:'((?:\\.|[^'\\\n])*)'))`;

const UI_LITERAL_SINKS = Object.freeze([
  {
    label: "text assignment",
    pattern: new RegExp(String.raw`\.(?:textContent|innerText|placeholder|title)\s*=\s*${STRING_LITERAL}`, "gu"),
  },
  {
    label: "accessible attribute",
    pattern: new RegExp(String.raw`\.setAttribute\(\s*["'](?:aria-label|title|placeholder)["']\s*,\s*${STRING_LITERAL}`, "gu"),
  },
  {
    label: "text node",
    pattern: new RegExp(String.raw`(?:createTextNode|insertAdjacentText)\(\s*${STRING_LITERAL}`, "gu"),
  },
]);

function decodeLiteral(match) {
  const body = match[1] ?? match[2] ?? "";
  return body
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([\\"'])/g, "$1");
}

function looksLikeInterfaceCopy(value) {
  const text = String(value || "").trim();
  if (text.length < 2 || !/\p{L}/u.test(text)) return false;
  if (/^(?:true|false|null|undefined)$/iu.test(text)) return false;
  if (/^(?:https?:\/\/|\/api\/|data:|#[a-z0-9_-]+$)/iu.test(text)) return false;
  return true;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function pushFinding(findings, known, value, source, index, sink) {
  const text = String(value || "").replace(/\s+/gu, " ").trim();
  if (!looksLikeInterfaceCopy(text) || known.has(text) || text.includes("${")) return;
  findings.push({ value: text, line: lineNumberAt(source, index), sink });
}

function stringAndTemplateLiterals(source) {
  const literals = [];
  let index = 0;
  while (index < source.length) {
    const quote = source[index];
    if (!["'", '"', "`"].includes(quote)) {
      index += 1;
      continue;
    }

    const start = index;
    index += 1;
    let body = "";
    while (index < source.length) {
      const char = source[index];
      if (char === "\\") {
        body += char;
        if (index + 1 < source.length) body += source[index + 1];
        index += 2;
        continue;
      }
      if (char === quote) {
        index += 1;
        break;
      }
      body += char;
      index += 1;
    }
    literals.push({ body, start });
  }
  return literals;
}

export function findUntranslatedHtmlLiterals(source, translatedValues) {
  const known = translatedValues instanceof Set ? translatedValues : new Set(translatedValues || []);
  const findings = [];

  for (const literal of stringAndTemplateLiterals(source)) {
    if (!/<[a-z][^>]*>/iu.test(literal.body)) continue;

    const visibleMarkup = literal.body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "");

    for (const match of visibleMarkup.matchAll(/>([^<>]+)</gu)) {
      const value = match[1]
        .replace(/&nbsp;/giu, " ")
        .replace(/&amp;/giu, "&")
        .trim();
      pushFinding(findings, known, value, source, literal.start + (match.index || 0), "HTML text");
    }

    for (const match of visibleMarkup.matchAll(/\b(?:aria-label|title|placeholder)=["']([^"']+)["']/giu)) {
      pushFinding(findings, known, match[1], source, literal.start + (match.index || 0), "HTML attribute");
    }
  }

  return findings;
}

export function findUntranslatedUiLiterals(source, translatedValues) {
  const known = translatedValues instanceof Set ? translatedValues : new Set(translatedValues || []);
  const findings = [];

  for (const sink of UI_LITERAL_SINKS) {
    sink.pattern.lastIndex = 0;
    for (const match of source.matchAll(sink.pattern)) {
      const value = decodeLiteral(match).trim();
      if (!looksLikeInterfaceCopy(value) || known.has(value)) continue;
      findings.push({
        value,
        line: lineNumberAt(source, match.index || 0),
        sink: sink.label,
      });
    }
  }

  findings.push(...findUntranslatedHtmlLiterals(source, known));
  return findings;
}

export { UI_LITERAL_SINKS };
