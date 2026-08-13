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

  return findings;
}

export { UI_LITERAL_SINKS };
