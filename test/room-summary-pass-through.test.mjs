import test from "node:test";
import assert from "node:assert/strict";
import { formatRoomSummarySource } from "../src/features/sales/sale-english-ui.js";

test("room summary preserves preprocessed room facts and only formats presentation", () => {
  const source = `Địa chỉ: Số 3 ngách 140 ngõ 36 Dịch Vọng Hậu - Cầu Giấy

Phòng trống:
+ P301, P401 – 5tr2
+ P602 – 5tr6

Dạng phòng: Phòng đơn – 28m²
Thang: Máy

Nội thất: Điều hòa, nóng lạnh, giường, tủ quần áo, kệ bếp, máy giặt chung, tủ lạnh, bếp từ, bàn trang điểm`;

  assert.deepEqual(formatRoomSummarySource(source), [
    { type: "field", label: "Địa chỉ", value: "Số 3 ngách 140 ngõ 36 Dịch Vọng Hậu - Cầu Giấy" },
    { type: "heading", label: "Phòng trống" },
    { type: "bullet", value: "P301, P401 – 5tr2" },
    { type: "bullet", value: "P602 – 5tr6" },
    { type: "field", label: "Dạng phòng", value: "Phòng đơn – 28m²" },
    { type: "field", label: "Thang", value: "Máy" },
    { type: "field", label: "Nội thất", value: "Điều hòa, nóng lạnh, giường, tủ quần áo, kệ bếp, máy giặt chung, tủ lạnh, bếp từ, bàn trang điểm" },
  ]);
});

test("room summary pass-through does not infer or rewrite unknown lines", () => {
  const source = `Giá đặc biệt: 5tr25\nGhi chú tự do không có nhãn\n- Giữ nguyên nội dung này`;
  assert.deepEqual(formatRoomSummarySource(source), [
    { type: "field", label: "Giá đặc biệt", value: "5tr25" },
    { type: "text", value: "Ghi chú tự do không có nhãn" },
    { type: "bullet", value: "Giữ nguyên nội dung này" },
  ]);
});
