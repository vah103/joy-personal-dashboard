import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("production build resolves dashboard tokens and keeps referenced assets available", async () => {
  const source = await read("src/pages/dashboard/index.html");
  const assetPaths = [
    ...source.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g),
  ]
    .map((match) => match[1])
    .filter((path) => !path.startsWith("http") && !path.startsWith("#") && path !== "/sale-manager.html");

  assert.equal(new Set(assetPaths).size, assetPaths.length, "Dashboard assets should not be declared twice");
  assert.equal(source.match(/JOY_CLOUDFLARE_BACKEND/g)?.length, 1);

  for (const assetPath of new Set(assetPaths)) {
    const relativePath = assetPath.replace(/^\//, "");
    const candidates = [
      new URL(`src/pages/dashboard/${relativePath}`, root),
      new URL(`src/features/${relativePath}`, root),
      new URL(`src/${relativePath}`, root),
      new URL(relativePath, root),
    ];
    let found = false;
    for (const candidate of candidates) {
      try {
        await access(candidate);
        found = true;
        break;
      } catch {
        // Continue through canonical source locations.
      }
    }
    if (!found) {
      const build = await read("scripts/build.mjs");
      assert.match(build, new RegExp(relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});
