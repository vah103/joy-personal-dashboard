import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRoomListing } from "../src/pages/sale/room-summary.js";

test("parses price-first room groups without dropping rooms", () => {
  const summary = summarizeRoomListing(`
    🌷20%-hd 30/8/2027 Mã: 🏆 168

    🏢Địa chỉ : Ngõ 278/20/25 Kim Giang
    - Quận: Hoàng mai

    ⌛️1/9 Trống :

    ☘Giá 4tr4-p201-301-501-601
    4tr5-202-302-402-502
    4tr1-303-403-603
    4tr3-204
    4tr5-305-405
    ☘Dạng phòng : gác xép
    ☘Thang : máy

    🏆Nội thất : Điều hoà, nóng lạnh, giường,tủ quần áo, máy giặt chung,tủ lạnh +200k

    🏆Dịch vụ : Điện 4k2 , nước 38k , Mạng 100k/ phòng ( ở từ 3 người trở lên 150k/ phòng ) , tất cả các dịch vụ chung khác : 180k/1 người , Xe : miễn phí

    ⭐Lưu ý:
    - Đóng 1 cọc 1
    - Giới hạn xe,ng
    - PET :
    - Ngõ ô tô :
    - Nguồn hàng cập nhật liên tục tại
      🏆TL21House🏆
  `);

  assert.equal(summary.address, "Ngõ 278/20/25 Kim Giang - Quận: Hoàng mai");
  assert.equal(
    summary.availability,
    "P201, P301, P501, P601, P202, P302, P402, P502, P303, P403, P603, P204, P305, P405 (trống 1/9)",
  );
  assert.deepEqual(
    summary.rooms.map(({ title, price }) => [title, price]),
    [
      ["Phòng P201", "4tr4"], ["Phòng P301", "4tr4"], ["Phòng P501", "4tr4"], ["Phòng P601", "4tr4"],
      ["Phòng P202", "4tr5"], ["Phòng P302", "4tr5"], ["Phòng P402", "4tr5"], ["Phòng P502", "4tr5"],
      ["Phòng P303", "4tr1"], ["Phòng P403", "4tr1"], ["Phòng P603", "4tr1"],
      ["Phòng P204", "4tr3"],
      ["Phòng P305", "4tr5"], ["Phòng P405", "4tr5"],
    ],
  );
  assert.equal(
    summary.price,
    "4tr4-P201-301-501-601\n4tr5-202-302-402-502\n4tr1-303-403-603\n4tr3-204\n4tr5-305-405",
  );
  assert.deepEqual(summary.roomPresentation, {
    mode: "single",
    summary: "14 phòng · Trống từ 1/9",
    priceGroups: [
      { price: "4tr1", rooms: ["P303", "P403", "P603"] },
      { price: "4tr3", rooms: ["P204"] },
      { price: "4tr4", rooms: ["P201", "P301", "P501", "P601"] },
      { price: "4tr5", rooms: ["P202", "P302", "P402", "P502", "P305", "P405"] },
    ],
  });
  assert.deepEqual(summary.services.map(({ label, value }) => [label, value]), [
    ["Điện", "4k2/số"],
    ["Nước", "38k/khối"],
    ["Mạng", "100k/phòng (ở từ 3 người trở lên 150k/phòng), tất cả các"],
    ["Dịch vụ chung", "khác: 180k/1 người, Xe: miễn phí"],
  ]);
  assert.deepEqual(summary.notes, ["Đóng 1 cọc 1", "Giới hạn xe, ng"]);
});

test("switches to availability-first groups when rooms have different move-in dates", () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: 10 Kim Giang
    Vào luôn: P201-301
    1/9 Trống: P202-302-502
    Giá 4tr4-P201-301
    4tr5-P202-302-502
    Dạng phòng: Studio
  `);

  assert.deepEqual(summary.roomPresentation, {
    mode: "multi",
    groups: [
      {
        label: "Vào luôn",
        priceGroups: [{ price: "4tr4", rooms: ["P201", "P301"] }],
      },
      {
        label: "Từ 1/9",
        priceGroups: [{ price: "4tr5", rooms: ["P202", "P302", "P502"] }],
      },
    ],
  });
});

test("room-first fallback does not borrow a price from the next line", () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: 10 Kim Giang
    p201-301-501
    4tr5-202-302
  `);

  assert.notEqual(summary.availability, "P201-301-501");
  assert.notEqual(summary.price, "4tr5");
});
