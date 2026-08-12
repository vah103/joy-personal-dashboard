import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRoomListing } from "../src/pages/sale/room-summary.js";

test("keeps notes attached to service values while still compacting thousand amounts", () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: 66 Hồ Tùng Mậu
    Dịch vụ:
    Điện: 4000/số - giá chưa gồm điều hòa
    Nước: 30000/khối - dùng bao nhiêu tính bấy nhiêu
    Dịch vụ chung: 150k/người (vệ sinh, thang máy, máy giặt chung) - xe điện báo trước
  `);

  assert.deepEqual(summary.services.map(({ label, value }) => [label, value]), [
    ["Điện", "4k/số - giá chưa gồm điều hòa"],
    ["Nước", "30k/khối - dùng bao nhiêu tính bấy nhiêu"],
    ["Dịch vụ chung", "150k/người (vệ sinh, thang máy, máy giặt chung) - xe điện báo trước"],
  ]);
});

test("keeps the complete labeled price text when several rooms or notes are present", () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: 105 Doãn Kế Thiện
    Trống: P201, P202
    Giá: P201 4tr5; P202 4tr8 - phòng góc thêm ban công
  `);

  assert.equal(summary.price, "P201 4tr5; P202 4tr8 - phòng góc thêm ban công");
});

test("keeps multiline labeled price details instead of dropping room-specific lines", () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: 180 Phú Mỹ
    Trống: P201, P202
    Giá:
    P201: 4tr5
    P202: 4tr8
    Nội thất: Full đồ
  `);

  assert.match(summary.price, /P201:\s*4tr5/);
  assert.match(summary.price, /P202:\s*4tr8/);
});
