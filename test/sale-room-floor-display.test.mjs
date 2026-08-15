import test from "node:test";
import assert from "node:assert/strict";
import { parseJoyRoomText } from "../src/pages/sale/room-address-ai.js";

function prepared(body) {
  return `
Địa chỉ: 26 Nguyễn Ngọc Vũ
Phòng:
${body}
Dạng phòng: Studio
Thang máy: Không
Nội thất: Như hình
Dịch vụ:
- Điện: 4k/số
Lưu ý:
`;
}

test("floor-only Joy Room Text preserves floor, price and availability", () => {
  const summary = parseJoyRoomText(prepared("- Tầng 2 | 6tr2 | ở luôn"));
  assert.equal(summary.floor, "2");
  assert.deepEqual(summary.rooms, [
    { room: "", price: "6tr2", availability: "ở luôn" },
  ]);
});

test("Joy Room Text rejects mixing a floor-only row with explicit room IDs", () => {
  const summary = parseJoyRoomText(prepared("- Tầng 2 | 6tr2\n- P302 | 7tr | 31/8"));
  assert.equal(summary, null);
});

test("address text containing a floor never becomes room floor", () => {
  const source = `
Địa chỉ: Tầng 2, số 10 phố A
Phòng:
- P302 | 6tr | 1/9
Dạng phòng: Studio
Thang máy: Có
Nội thất: Như hình
Dịch vụ:
- Điện: 4k/số
Lưu ý:
`;
  const summary = parseJoyRoomText(source);
  assert.equal(summary.floor, "");
  assert.equal(summary.rooms[0].room, "P302");
});
