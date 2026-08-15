import test from "node:test";
import assert from "node:assert/strict";
import { parseJoyRoomText } from "../src/pages/sale/room-address-ai.js";

test("Joy Room Text keeps room price and availability attached to each room", () => {
  const source = `
Địa chỉ: Số nhà 33+35 ngõ 113 Thái Thịnh - Đống Đa

Phòng:
- P203 | 6tr8 | 6/9
- P301 | 7tr | 31/8
- P302 | 7tr | 31/8
- P501 | 7tr | 2/9
- P602 | 7tr | ở luôn

Dạng phòng: 1N1K
Thang máy: Có
Nội thất: Full đồ như ảnh

Dịch vụ:
- Điện: 4k/số
- Nước: 35k/khối
- Mạng: 100k/phòng
- Dịch vụ chung: 150k/người | Gồm: Vệ sinh, thang máy

Lưu ý:
- Đóng 1 cọc 1
- Không nhận khách nước ngoài
`;

  assert.deepEqual(parseJoyRoomText(source), {
    address: "Số nhà 33+35 ngõ 113 Thái Thịnh - Đống Đa",
    rooms: [
      { room: "P203", price: "6tr8", availability: "6/9" },
      { room: "P301", price: "7tr", availability: "31/8" },
      { room: "P302", price: "7tr", availability: "31/8" },
      { room: "P501", price: "7tr", availability: "2/9" },
      { room: "P602", price: "7tr", availability: "ở luôn" },
    ],
    floor: "",
    roomType: "1N1K",
    elevator: "Có",
    furniture: "Full đồ như ảnh",
    services: {
      electricity: "4k/số",
      water: "35k/khối",
      items: [
        { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
        { kind: "common", name: "Dịch vụ chung", value: "150k/người", includes: ["Vệ sinh", "thang máy"] },
      ],
    },
    notes: ["Đóng 1 cọc 1", "Không nhận khách nước ngoài"],
  });
});

test("Joy Room Text supports a floor-only listing", () => {
  const source = `
Địa chỉ: 26 Nguyễn Văn Cừ - Long Biên
Phòng:
- Tầng 2 | 6tr2 | ở luôn
Dạng phòng: Studio
Thang máy: Không
Nội thất: Như hình
Dịch vụ:
- Điện: 4k/số
Lưu ý:
`;

  const summary = parseJoyRoomText(source);
  assert.equal(summary.floor, "2");
  assert.deepEqual(summary.rooms, [
    { room: "", price: "6tr2", availability: "ở luôn" },
  ]);
});

test("raw listing text is rejected instead of falling back to AI", () => {
  const raw = `
30%-12m Mã: 018
Địa chỉ: 33 ngõ 113 Thái Thịnh - Đống Đa
Trống:
Giá: 7tr-p301(31/8)-302(31/8)
Dạng phòng: 1n1k
Thang: máy
Nội thất: Full đồ
Dịch vụ: điện 4k/số, nước 35k/khối
`;

  assert.equal(parseJoyRoomText(raw), null);
});

test("missing a required Joy Room Text section is rejected", () => {
  const source = `
Địa chỉ: 180 Phú Mỹ
Phòng:
- P302 | 4tr2 | ở luôn
Dạng phòng: Studio
Thang máy: Có
Nội thất: Như hình
Dịch vụ:
- Điện: 4k/số
`;

  assert.equal(parseJoyRoomText(source), null);
});
