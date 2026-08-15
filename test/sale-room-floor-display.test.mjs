import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function loadFloorExtractor() {
  const frontend = await readFile(new URL("../src/pages/sale/room-address-ai.js", import.meta.url), "utf8");
  const start = frontend.indexOf("function extractFloorForDisplay");
  const end = frontend.indexOf("\nfunction editableValue", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const source = frontend.slice(start, end);
  return new Function(`${source}; return extractFloorForDisplay;`)();
}

test("floor-only listing preserves the floor next to its listing-wide price", async () => {
  const extractFloorForDisplay = await loadFloorExtractor();
  const source = `
🏢Địa chỉ : Số 26A ngõ 189/93 Nguyễn Ngọc Vũ, Trung Hoà, Cầu
⌛️Trống : tầng 2
☘Giá : 6tr2
☘Dạng phòng : 1n1k
  `;

  assert.equal(extractFloorForDisplay(source, [
    { room: "", price: "6tr2", availability: "" },
  ]), "2");
});

test("floor fallback never overrides an explicit room code", async () => {
  const extractFloorForDisplay = await loadFloorExtractor();
  const source = "Trống: P302 tầng 3";
  assert.equal(extractFloorForDisplay(source, [
    { room: "P302", price: "7tr", availability: "" },
  ]), "");
});

test("address text alone cannot become the room floor", async () => {
  const extractFloorForDisplay = await loadFloorExtractor();
  const source = "Địa chỉ: Tầng 2, số 10 phố A\nGiá: 6tr";
  assert.equal(extractFloorForDisplay(source, [
    { room: "", price: "6tr", availability: "" },
  ]), "");
});