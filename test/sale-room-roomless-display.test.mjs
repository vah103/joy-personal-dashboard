import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseJoyRoomText } from "../src/pages/sale/room-address-ai.js";

test("floor-only Joy Room Text uses floor as the display identifier", () => {
  const source = `
Địa chỉ: 12 phố A
Phòng:
- Tầng 4 | 3tr | ở luôn
Dạng phòng: Studio
Thang máy: Không
Nội thất: Như hình
Dịch vụ:
- Điện: 4k/số
Lưu ý:
`;
  const summary = parseJoyRoomText(source);
  assert.equal(summary.floor, "4");
  assert.deepEqual(summary.rooms, [{ room: "", price: "3tr", availability: "ở luôn" }]);
});

test("explicit Joy Room Text room IDs are never promoted from a floor", () => {
  const source = `
Địa chỉ: 12 phố A
Phòng:
- P401 | 3tr | 1/9
Dạng phòng: Studio
Thang máy: Có
Nội thất: Như hình
Dịch vụ:
- Điện: 4k/số
Lưu ý:
`;
  const summary = parseJoyRoomText(source);
  assert.equal(summary.floor, "");
  assert.equal(summary.rooms[0].room, "P401");
});

test("Joy Room Text keeps prepared furniture copy instead of re-normalizing it", () => {
  const source = `
Địa chỉ: 12 phố A
Phòng:
- P401 | 3tr
Dạng phòng: Studio
Thang máy: Có
Nội thất: Điều hòa, nóng lạnh, giường, tủ
Dịch vụ:
- Điện: 4k/số
Lưu ý:
`;
  assert.equal(parseJoyRoomText(source).furniture, "Điều hòa, nóng lạnh, giường, tủ");
});

test("floor-only rendering never creates a placeholder room dash", async () => {
  const frontend = await readFile(new URL("../src/pages/sale/room-address-ai.js", import.meta.url), "utf8");
  assert.doesNotMatch(frontend, /room\.room\s*\|\|\s*["']—["']/u);
  assert.match(frontend, /appendFloorFacts\(details, floor, roomlessFacts\)/u);
});
