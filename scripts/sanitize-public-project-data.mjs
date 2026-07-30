import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const turtleBotDirectory = resolve(root, "dist", "project-data", "turtlebot4");
const PRIVATE_DOCUMENT_PATTERN = /https:\/\/docs\.google\.com\/[^\s"'`<>]+/g;
const PRIVATE_DOCUMENT_ID_PATTERN = /16tNFhp4qvS8rlGTzL_8DQ_3fGJJoasrL1hJAQ16xPkk/g;
const TEXT_EXTENSIONS = new Set([".html", ".js", ".json", ".md", ".txt"]);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) results.push(...await filesIn(path));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) results.push(path);
  }
  return results;
}

function removePrivateKeys(value) {
  if (Array.isArray(value)) return value.map(removePrivateKeys);
  if (!value || typeof value !== "object") return value;

  const sanitized = {};
  for (const [key, child] of Object.entries(value)) {
    if (/^(googleDocUrl|documentUrl|privateDocumentUrl)$/i.test(key)) continue;
    sanitized[key] = removePrivateKeys(child);
  }
  return sanitized;
}

for (const path of await filesIn(turtleBotDirectory)) {
  let source = await readFile(path, "utf8");
  if (extname(path) === ".json") {
    try {
      source = `${JSON.stringify(removePrivateKeys(JSON.parse(source)))}\n`;
    } catch {
      // Some project-data files use JavaScript-style fragments despite the extension.
    }
  }

  source = source
    .replace(PRIVATE_DOCUMENT_PATTERN, "#private-document")
    .replace(PRIVATE_DOCUMENT_ID_PATTERN, "private-document");

  if (/docs\.google\.com|16tNFhp4qvS8rlGTzL_8DQ_3fGJJoasrL1hJAQ16xPkk/.test(source)) {
    throw new Error(`Private document reference remains in deploy artifact: ${path}`);
  }
  await writeFile(path, source);
}

console.log("Private TurtleBot document links removed from deploy artifacts");
