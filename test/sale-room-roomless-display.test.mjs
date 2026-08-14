import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

async function loadDisplayHelpers() {
  const frontend = await readFile(
    new URL("../src/pages/sale/room-address-ai.js", import.meta.url),
    "utf8",
  );
  const sandbox = {
    document: {
      readyState: "loading",
      addEventListener() {},
    },
  };
  vm.runInNewContext(
    `${frontend}\nthis.__helpers = { normalizeFurnitureForDisplay, extractFloorForDisplay };`,
    sandbox,
  );
  return { frontend, ...sandbox.__helpers };
}

test("uses floor as the fallback identifier only when no room code exists", async () => {
  const { extractFloorForDisplay } = await loadDisplayHelpers();

  assert.equal(
    extractFloorForDisplay("Phòng tầng 4\nGiá thuê: 3tr", [{ room: "", price: "3tr", availability: "" }]),
    "4",
  );
  assert.equal(
    extractFloorForDisplay("Phòng P401 tầng 4\nGiá thuê: 3tr", [{ room: "P401", price: "3tr", availability: "" }]),
    "",
  );
  assert.equal(
    extractFloorForDisplay("Có phòng tầng 3 và phòng tầng 4", [{ room: "", price: "", availability: "" }]),
    "",
  );
});

test("normalizes common furniture abbreviations for customer display", async () => {
  const { normalizeFurnitureForDisplay } = await loadDisplayHelpers();

  assert.equal(
    normalizeFurnitureForDisplay("Đh, NL, giường, tủ"),
    "Điều hòa, nóng lạnh, giường, tủ",
  );
  assert.equal(normalizeFurnitureForDisplay("Như hình"), "Như hình");
});

test("roomless listings no longer render a placeholder room dash", async () => {
  const { frontend } = await loadDisplayHelpers();

  assert.doesNotMatch(frontend, /room\.room\s*\|\|\s*["']—["']/u);
  assert.match(frontend, /appendFloorFacts\(details, floor, roomlessFacts\)/u);
  assert.match(frontend, /appendLabeledValue\(details, \["G", "iá"\], roomlessFacts\.price\)/u);
  assert.match(frontend, /appendLabeledValue\(details, \["T", "rống"\], roomlessFacts\.availability\)/u);
});
