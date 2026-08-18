import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRoomListing } from "../src/features/sales/room-summary/legacy-room-summary.js";

test("final polish removes empty notes and restores missing utility units", () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: ngõ 117/ 15/ 2A Trần Cung - Quận : Cầu Giấy
    Trống: đang trống
    Giá: 5tr-p701, 4tr7-p704 4tr4-p702, 4tr-p703
    Dạng phòng: studio
    Thang: máy
    Nội thất: Điều hoà, nóng lạnh, giường, tủ quần áo, máy giặt chung, tủ lạnh +200k
    Dịch vụ:
    Điện: 4k2
    Nước: 38k
    Mạng: 100k/phòng (ở từ 3 người trở lên 150k/phòng)
    Dịch vụ chung: khác : 180k/1 người, Xe : miễn phí
    Lưu ý:
    - Đóng 1 cọc 1
    - Giới hạn xe,ng
    - Pet :
    - Ngõ ô tô :
  `);

  assert.equal(summary.address, "Ngõ 117/15/2A Trần Cung - Quận: Cầu Giấy");
  assert.equal(summary.availability, "Đang trống");
  assert.match(summary.price, /P701/);
  assert.deepEqual(summary.services.map(({ label, value }) => [label, value]), [
    ["Điện", "4k2/số"],
    ["Nước", "38k/khối"],
    ["Mạng", "100k/phòng (ở từ 3 người trở lên 150k/phòng)"],
    ["Dịch vụ chung", "khác: 180k/1 người, Xe: miễn phí"],
  ]);
  assert.deepEqual(summary.notes, ["Đóng 1 cọc 1", "Giới hạn xe, ng"]);
});

test("final polish keeps explicit electricity and water units unchanged", () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: 66 Hồ Tùng Mậu
    Dịch vụ: Điện 4000/số; Nước 35k/m3; Điện 4k/ngày; Nước 100k/người
  `);

  const services = Object.fromEntries(summary.services.map(({ label, value }) => [label, value]));
  assert.match(services["Điện"], /^4k\/số/);
  assert.doesNotMatch(services["Điện"], /\/số\/số/);
  assert.match(services["Nước"], /^35k\/m³/);
  assert.doesNotMatch(services["Nước"], /\/khối\/m³/);
});
