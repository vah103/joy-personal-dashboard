import test from "node:test";
import assert from "node:assert/strict";
import { parseJoyRoomText } from "../src/pages/sale/room-address-ai.js";

test("Joy Room Text preserves prepared room IDs exactly for display", () => {
  const source = `
Địa chỉ: 180 Phú Mỹ
Phòng:
- P502 | 4tr8 | 1/9
- P602 | 4tr8 | ở luôn
Dạng phòng: Studio
Thang máy: Có
Nội thất: Như hình
Dịch vụ:
- Điện: 4k/số
Lưu ý:
`;

  const summary = parseJoyRoomText(source);
  assert.deepEqual(summary.rooms, [
    { room: "P502", price: "4tr8", availability: "1/9" },
    { room: "P602", price: "4tr8", availability: "ở luôn" },
  ]);
});
