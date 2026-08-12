import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL,
  normalizeRoomSummaryPolishInput,
  SALE_ROOM_SUMMARY_AI_PATH,
  validateRoomSummaryAiPolish,
} from "../worker/sale-room-summary-ai.js";

const SOURCE = {
  furniture: "Full đồ nội thất sofa, bàn trà, bàn làm việc, bếp từ, máy Giặt Riêng",
  services: [
    { key: "electricity", value: "4k/số" },
    { key: "water", value: "35k/m Dv chung 150k/người Wiffi 100k/phòng Xe đầu free" },
    { key: "parking", value: "2 - 100k 1 xe" },
  ],
  notes: [
    "Đóng 1 cọc 1",
    "\"Không chung chủ - không giới hạn người ở - không nuôi pet - không khách nước ngoài",
    "Cách trường Cao đẳng Y Hà Nội chỉ 300m\"",
    "Qua xem phòng liên hệ trước 30p",
    "Nhà không chung chủ - giờ giấc tự do",
  ],
};

const GOOD_POLISH = {
  furniture: "Full đồ nội thất: sofa, bàn trà, bàn làm việc, bếp từ, máy giặt riêng",
  services: [
    { key: "electricity", value: "4k/số" },
    { key: "water", value: "35k/m" },
    { key: "common", value: "150k/người" },
    { key: "internet", value: "100k/phòng" },
    { key: "parking", value: "Xe đầu tiên miễn phí; xe thứ 2: 100k/xe" },
  ],
  notes: [
    "Đóng 1 cọc 1",
    "Không chung chủ, không giới hạn người ở, không nuôi thú cưng, không nhận khách nước ngoài, giờ giấc tự do",
    "Cách Trường Cao đẳng Y Hà Nội chỉ 300m",
    "Qua xem phòng liên hệ trước 30 phút",
  ],
};

test("room-summary AI route and model are explicit", () => {
  assert.equal(SALE_ROOM_SUMMARY_AI_PATH, "/api/sales/room-summary/polish");
  assert.equal(DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
});

test("normalizes only polishable Room Summary fields", () => {
  assert.deepEqual(normalizeRoomSummaryPolishInput(SOURCE), {
    furniture: SOURCE.furniture,
    services: [
      { key: "electricity", label: "Điện", value: "4k/số" },
      { key: "water", label: "Nước", value: "35k/m Dv chung 150k/người Wiffi 100k/phòng Xe đầu free" },
      { key: "parking", label: "Gửi xe", value: "2 - 100k 1 xe" },
    ],
    notes: [
      "Đóng 1 cọc 1",
      "Không chung chủ - không giới hạn người ở - không nuôi pet - không khách nước ngoài",
      "Cách trường Cao đẳng Y Hà Nội chỉ 300m",
      "Qua xem phòng liên hệ trước 30p",
      "Nhà không chung chủ - giờ giấc tự do",
    ],
  });
});

test("accepts spelling cleanup and service splitting when factual numbers stay unchanged", () => {
  assert.deepEqual(validateRoomSummaryAiPolish(SOURCE, GOOD_POLISH), {
    valid: true,
    reason: "ok",
  });
});

test("rejects AI output that changes a service fee", () => {
  const changed = structuredClone(GOOD_POLISH);
  changed.services[1].value = "40k/m";
  assert.equal(validateRoomSummaryAiPolish(SOURCE, changed).valid, false);
  assert.equal(validateRoomSummaryAiPolish(SOURCE, changed).reason, "money-facts-changed");
});

test("rejects AI output that changes a non-money numeric fact", () => {
  const changed = structuredClone(GOOD_POLISH);
  changed.notes[2] = "Cách Trường Cao đẳng Y Hà Nội chỉ 500m";
  assert.equal(validateRoomSummaryAiPolish(SOURCE, changed).valid, false);
  assert.equal(validateRoomSummaryAiPolish(SOURCE, changed).reason, "numeric-facts-changed");
});
