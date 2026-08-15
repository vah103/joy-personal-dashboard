import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const frontend = await readFile(
  new URL("../src/pages/sale/sale-manager.js", import.meta.url),
  "utf8",
);

test("Sale Manager converts percentage input to a fractional commission rate before saving", () => {
  assert.match(
    frontend,
    /function percentInputToRate\(value\)\s*\{\s*return Number\(value \|\| 0\) \/ 100;\s*\}/u,
  );
  assert.match(frontend, /rate:\s*percentInputToRate\(form\.get\("rate"\)\)/u);
});

test("Sale Manager uses the same percentage conversion for the commission preview", () => {
  assert.match(
    frontend,
    /const rate = percentInputToRate\(elements\.form\.elements\.rate\.value\)/u,
  );
});
