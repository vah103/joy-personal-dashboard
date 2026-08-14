import test from "node:test";
import assert from "node:assert/strict";
import {
  SALE_ROOM_SUMMARY_AI_EXTRACT_PATH,
  sanitizeRoomSummaryAiExtraction,
  validateRoomSummaryAiExtraction,
} from "../worker/sale-room-summary-extract.js";

const DICH_VONG_HAU_SOURCE = `
CHO THUÊ PHÒNG TẠI DỊCH VỌNG HẬU
-Địa chỉ: 16A Dịch Vọng Hậu, Cầu Giấy, Hà Nội
-S phòng: 22m2, vệ sinh khép kín  nhà thang bộ.
-Phòng tầng 4
-Nội thất: ĐH, Nóng lạnh, giường tủ.
-Vị trí cực đẹp, gần nhiều trường ĐH, ô tô đỗ cửa
-Cạnh trường TC Ngân Hàng.
-Giá thuê: 3tr
-Thanh toán: 1 cọc 1
-Phí dịch vụ: Điện 4k, nước 135k/ng, dv chung: 180k/ng (vệ sinh, rác, mạng, điện chung, máy giặt...)
-Hoa hồng: 50%
-HĐ 12 tháng
-Tối 23h30-24h đóng cửa, 5h sáng mở
Lh: A Tuấn 0962579207 @All
`;

const DICH_VONG_HAU_EXTRACTION = {
  address: {
    value: "16A Dịch Vọng Hậu, Cầu Giấy, Hà Nội",
    evidence: ["Địa chỉ: 16A Dịch Vọng Hậu, Cầu Giấy, Hà Nội"],
  },
  area: {
    value: "22m²",
    evidence: ["S phòng: 22m2, vệ sinh khép kín nhà thang bộ."],
  },
  floor: {
    value: "Tầng 4",
    evidence: ["Phòng tầng 4"],
  },
  price: {
    value: "3 triệu/tháng",
    evidence: ["Giá thuê: 3tr"],
  },
  availability: { value: "", evidence: [] },
  roomType: {
    value: "Phòng khép kín",
    evidence: ["S phòng: 22m2, vệ sinh khép kín nhà thang bộ."],
  },
  elevator: {
    value: "no",
    evidence: ["S phòng: 22m2, vệ sinh khép kín nhà thang bộ."],
  },
  rooms: [],
  furniture: [
    { value: "Điều hòa", evidence: ["Nội thất: ĐH, Nóng lạnh, giường tủ."] },
    { value: "Nóng lạnh", evidence: ["Nội thất: ĐH, Nóng lạnh, giường tủ."] },
    { value: "Giường", evidence: ["Nội thất: ĐH, Nóng lạnh, giường tủ."] },
    { value: "Tủ", evidence: ["Nội thất: ĐH, Nóng lạnh, giường tủ."] },
  ],
  services: [
    {
      key: "electricity",
      value: "4k/số",
      includes: [],
      evidence: ["Điện 4k"],
    },
    {
      key: "water",
      value: "135k/người",
      includes: [],
      evidence: ["nước 135k/ng"],
    },
    {
      key: "common",
      value: "180k/người",
      includes: ["Vệ sinh", "Rác", "Mạng", "Điện chung", "Máy giặt"],
      evidence: ["dv chung: 180k/ng (vệ sinh, rác, mạng, điện chung, máy giặt...)"],
    },
  ],
  payment: {
    value: "Thanh toán 1 tháng, cọc 1 tháng",
    evidence: ["Thanh toán: 1 cọc 1"],
  },
  contract: {
    value: "Hợp đồng 12 tháng",
    evidence: ["HĐ 12 tháng"],
  },
  notes: [
    {
      value: "23h30–24h đóng cửa, 5h sáng mở cửa",
      evidence: ["Tối 23h30-24h đóng cửa, 5h sáng mở"],
    },
    {
      value: "Ô tô đỗ cửa",
      evidence: ["Vị trí cực đẹp, gần nhiều trường ĐH, ô tô đỗ cửa"],
    },
    {
      value: "Gần nhiều trường đại học",
      evidence: ["Vị trí cực đẹp, gần nhiều trường ĐH, ô tô đỗ cửa"],
    },
    {
      value: "Cạnh trường TC Ngân Hàng",
      evidence: ["Cạnh trường TC Ngân Hàng."],
    },
  ],
};

test("Room Summary AI analysis path stays stable", () => {
  assert.equal(SALE_ROOM_SUMMARY_AI_EXTRACT_PATH, "/api/sales/room-summary/analyze");
});

test("accepts a semantic extraction for the Dịch Vọng Hậu listing", () => {
  assert.deepEqual(validateRoomSummaryAiExtraction(DICH_VONG_HAU_SOURCE, DICH_VONG_HAU_EXTRACTION), {
    valid: true,
    reason: "ok",
  });
});

test("keeps price, payment, area and floor as separate semantic fields", () => {
  const sanitized = sanitizeRoomSummaryAiExtraction(DICH_VONG_HAU_EXTRACTION);
  assert.equal(sanitized.price.value, "3 triệu/tháng");
  assert.equal(sanitized.payment.value, "Thanh toán 1 tháng, cọc 1 tháng");
  assert.equal(sanitized.area.value, "22m²");
  assert.equal(sanitized.floor.value, "Tầng 4");
  assert.equal(sanitized.availability.value, "");
});

test("understands ĐH as Điều hòa in the furniture context and rejects Đệm", () => {
  const changed = structuredClone(DICH_VONG_HAU_EXTRACTION);
  changed.furniture[0].value = "Đệm";
  assert.deepEqual(validateRoomSummaryAiExtraction(DICH_VONG_HAU_SOURCE, changed), {
    valid: false,
    reason: "furniture-item-not-supported",
  });
});

test("does not infer room availability from a for-rent headline", () => {
  const changed = structuredClone(DICH_VONG_HAU_EXTRACTION);
  changed.availability = {
    value: "Đang trống",
    evidence: ["CHO THUÊ PHÒNG TẠI DỊCH VỌNG HẬU"],
  };
  assert.deepEqual(validateRoomSummaryAiExtraction(DICH_VONG_HAU_SOURCE, changed), {
    valid: false,
    reason: "availability-not-supported",
  });
});

test("included common-service items cannot be invented as free services", () => {
  const changed = structuredClone(DICH_VONG_HAU_EXTRACTION);
  changed.services.push({
    key: "internet",
    value: "miễn phí",
    includes: [],
    evidence: ["dv chung: 180k/ng (vệ sinh, rác, mạng, điện chung, máy giặt...)"],
  });
  assert.deepEqual(validateRoomSummaryAiExtraction(DICH_VONG_HAU_SOURCE, changed), {
    valid: false,
    reason: "service-free-not-supported",
  });
});

test("included common-service items stay inside the common service without a separate charge", () => {
  const changed = structuredClone(DICH_VONG_HAU_EXTRACTION);
  changed.services.push({
    key: "internet",
    value: "Bao gồm trong phí dịch vụ chung",
    includes: [],
    evidence: ["dv chung: 180k/ng (vệ sinh, rác, mạng, điện chung, máy giặt...)"],
  });
  assert.deepEqual(validateRoomSummaryAiExtraction(DICH_VONG_HAU_SOURCE, changed), {
    valid: false,
    reason: "included-service-split",
  });
});

test("contact and broker metadata cannot leak into customer notes", () => {
  const changed = structuredClone(DICH_VONG_HAU_EXTRACTION);
  changed.notes.push({
    value: "Liên hệ: Anh Tuấn",
    evidence: ["Lh: A Tuấn 0962579207 @All"],
  });
  assert.deepEqual(validateRoomSummaryAiExtraction(DICH_VONG_HAU_SOURCE, changed), {
    valid: false,
    reason: "internal-note-selected",
  });
});

const GROUPED_SOURCE = `
180 Phú Mỹ, Mỹ Đình 2
Vào luôn: P201, P301
1/9 trống: P202
Giá: 4tr4 - P201, P301
4tr5 - P202
Studio, có thang máy
`;

const GROUPED_EXTRACTION = {
  address: { value: "180 Phú Mỹ, Mỹ Đình 2", evidence: ["180 Phú Mỹ, Mỹ Đình 2"] },
  area: { value: "", evidence: [] },
  floor: { value: "", evidence: [] },
  price: { value: "", evidence: [] },
  availability: { value: "", evidence: [] },
  roomType: { value: "Studio", evidence: ["Studio, có thang máy"] },
  elevator: { value: "yes", evidence: ["Studio, có thang máy"] },
  rooms: [
    { code: "P201", price: "4tr4", availability: "Vào luôn", evidence: ["Vào luôn: P201, P301", "Giá: 4tr4 - P201, P301"] },
    { code: "P301", price: "4tr4", availability: "Vào luôn", evidence: ["Vào luôn: P201, P301", "Giá: 4tr4 - P201, P301"] },
    { code: "P202", price: "4tr5", availability: "1/9", evidence: ["1/9 trống: P202", "4tr5 - P202"] },
  ],
  furniture: [],
  services: [],
  payment: { value: "", evidence: [] },
  contract: { value: "", evidence: [] },
  notes: [],
};

test("still accepts rooms with independent price and availability facts", () => {
  assert.deepEqual(validateRoomSummaryAiExtraction(GROUPED_SOURCE, GROUPED_EXTRACTION), {
    valid: true,
    reason: "ok",
  });
});

test("still rejects an invented room price", () => {
  const changed = structuredClone(GROUPED_EXTRACTION);
  changed.rooms[0].price = "4tr9";
  assert.deepEqual(validateRoomSummaryAiExtraction(GROUPED_SOURCE, changed), {
    valid: false,
    reason: "room-price-not-supported",
  });
});
