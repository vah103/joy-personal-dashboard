import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRoomListing } from "../src/pages/sale/room-summary.js";

test("parses decimal electricity, composite common fees and parking details", () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: Số nhà 14B ngách 43 ngõ 189 Nguyễn Ngọc Vũ (hoặc đi vào ngõ 37 Nguyễn Thị Định)
    Dịch vụ: Điện:3,8/số; nước 30k/ khối; mạng 100k/phòng; vsinh+thang máy+máy giặt chung: 150k/ng, để xe tầng 1 free., xe điện 150k/xe
  `);

  assert.deepEqual(summary.services.map(({ label, value }) => [label, value]), [
    ["Điện", "3,8k/số"],
    ["Nước", "30k/khối"],
    ["Mạng", "100k/phòng"],
    ["Dịch vụ chung", "150k/người (vệ sinh, thang máy, máy giặt chung)"],
    ["Gửi xe", "Tầng 1 miễn phí, xe điện 150k/xe"],
  ]);
});
