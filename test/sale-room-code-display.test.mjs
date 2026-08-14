import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function loadRoomCodeNormalizer() {
  const source = await readFile(new URL("../src/pages/sale/room-address-ai.js", import.meta.url), "utf8");
  const match = source.match(/function normalizeRoomCodeForDisplay\(value\) \{[\s\S]*?\n\}/u);
  assert.ok(match, "room code normalizer must exist in the Room Summary frontend");
  return Function(`${match[0]}; return normalizeRoomCodeForDisplay;`)();
}

test("Room Summary always displays numeric room IDs as uppercase P codes", async () => {
  const normalizeRoomCodeForDisplay = await loadRoomCodeNormalizer();

  assert.equal(normalizeRoomCodeForDisplay("502"), "P502");
  assert.equal(normalizeRoomCodeForDisplay("p502"), "P502");
  assert.equal(normalizeRoomCodeForDisplay("P502"), "P502");
  assert.equal(normalizeRoomCodeForDisplay("Phòng 502"), "P502");
  assert.equal(normalizeRoomCodeForDisplay("phong: p502"), "P502");
  assert.equal(normalizeRoomCodeForDisplay("602"), "P602");
});
