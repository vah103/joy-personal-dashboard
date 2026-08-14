import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRoomListing } from "../src/pages/sale/room-summary.js";
import {
  buildCanonicalRoomListing,
  SALE_ROOM_SUMMARY_AI_EXTRACT_PATH,
  sanitizeRoomSummaryAiExtraction,
  validateRoomSummaryAiExtraction,
} from "../worker/sale-room-summary-extract.js";

const SOURCE = `
180 Phú Mỹ, Mỹ Đình 2
Vào luôn: P201, P301
1/9 trống: P202
Giá: 4tr4 - P201, P301
4tr5 - P202
Studio, có thang máy
Full đồ: đh, nl, giường, tủ, bếp
Điện 4k/số; Nước 100k/người; Wifi 100k/phòng; xe đầu free
Cọc 1 tháng, không pet, không chung chủ, giờ giấc tự do
HH 50% - nguồn TLHouse - liên hệ 0912345678
`;

const EXTRACTION = {
  address: {
    value: "180 Phú Mỹ, Mỹ Đình 2",
    evidence: ["180 Phú Mỹ, Mỹ Đình 2"],
  },
  price: { value: "", evidence: [] },
  availability: { value: "", evidence: [] },
  roomType: { value: "Studio", evidence: ["Studio, có thang máy"] },
  elevator: { value: "yes", evidence: ["Studio, có thang máy"] },
  rooms: [
    {
      code: "P201",
      price: "4tr4",
      availability: "Vào luôn",
      evidence: ["Vào luôn: P201, P301", "Giá: 4tr4 - P201, P301"],
    },
    {
      code: "P301",
      price: "4tr4",
      availability: "Vào luôn",
      evidence: ["Vào luôn: P201, P301", "Giá: 4tr4 - P201, P301"],
    },
    {
      code: "P202",
      price: "4tr5",
      availability: "1/9",
      evidence: ["1/9 trống: P202", "4tr5 - P202"],
    },
  ],
  furniture: {
    value: "Đầy đủ nội thất: điều hòa, nóng lạnh, giường, tủ, bếp",
    evidence: ["Full đồ: đh, nl, giường, tủ, bếp"],
  },
  services: [
    { key: "electricity", value: "4k/số", evidence: ["Điện 4k/số"] },
    { key: "water", value: "100k/người", evidence: ["Nước 100k/người"] },
    { key: "internet", value: "100k/phòng", evidence: ["Wifi 100k/phòng"] },
    { key: "parking", value: "Xe đầu miễn phí", evidence: ["xe đầu free"] },
  ],
  notes: [
    {
      value: "Cọc 1 tháng, không nuôi thú cưng, không chung chủ, giờ giấc tự do",
      evidence: ["Cọc 1 tháng, không pet, không chung chủ, giờ giấc tự do"],
    },
  ],
};

test("Room Summary AI-first analysis path is explicit", () => {
  assert.equal(SALE_ROOM_SUMMARY_AI_EXTRACT_PATH, "/api/sales/room-summary/analyze");
});

test("accepts source-backed AI extraction across the full room listing", () => {
  assert.deepEqual(validateRoomSummaryAiExtraction(SOURCE, EXTRACTION), {
    valid: true,
    reason: "ok",
  });
});

test("canonical AI extraction preserves the existing grouped room-price presentation", () => {
  const canonical = buildCanonicalRoomListing(EXTRACTION);
  const summary = summarizeRoomListing(canonical);

  assert.equal(summary.address, "180 Phú Mỹ, Mỹ Đình 2");
  assert.equal(summary.roomType, "Studio");
  assert.equal(summary.stairs, "Có");
  assert.match(summary.furniture, /điều hòa/iu);
  assert.equal(summary.rooms.length, 3);
  assert.equal(summary.roomPresentation?.mode, "multi");
  assert.deepEqual(summary.roomPresentation?.groups.map((group) => group.label), ["Vào luôn", "Từ 1/9"]);
  assert.deepEqual(
    summary.roomPresentation?.groups.flatMap((group) => group.priceGroups.map((priceGroup) => [group.label, priceGroup.price, priceGroup.rooms])),
    [
      ["Vào luôn", "4tr4", ["P201", "P301"]],
      ["Từ 1/9", "4tr5", ["P202"]],
    ],
  );
});

test("rejects a room code the cited source evidence does not support", () => {
  const changed = structuredClone(EXTRACTION);
  changed.rooms[0].code = "P999";
  assert.deepEqual(validateRoomSummaryAiExtraction(SOURCE, changed), {
    valid: false,
    reason: "room-code-not-supported",
  });
});

test("rejects an invented room price", () => {
  const changed = structuredClone(EXTRACTION);
  changed.rooms[0].price = "4tr9";
  assert.deepEqual(validateRoomSummaryAiExtraction(SOURCE, changed), {
    valid: false,
    reason: "room-price-not-supported",
  });
});

test("rejects elevator polarity that conflicts with evidence", () => {
  const changed = structuredClone(EXTRACTION);
  changed.elevator.value = "no";
  assert.deepEqual(validateRoomSummaryAiExtraction(SOURCE, changed), {
    valid: false,
    reason: "elevator-value-not-supported",
  });
});

test("rejects internal sale-only content selected as a customer note", () => {
  const changed = structuredClone(EXTRACTION);
  changed.notes.push({ value: "HH 50%", evidence: ["HH 50%"] });
  assert.deepEqual(validateRoomSummaryAiExtraction(SOURCE, changed), {
    valid: false,
    reason: "internal-note-selected",
  });
});

test("sanitizer keeps only supported extraction structure", () => {
  const sanitized = sanitizeRoomSummaryAiExtraction(EXTRACTION);
  assert.equal(sanitized.rooms[0].code, "P201");
  assert.deepEqual(sanitized.services.map((service) => service.key), ["electricity", "water", "internet", "parking"]);
  assert.equal(sanitized.notes.length, 1);
});
