import test from "node:test";
import assert from "node:assert/strict";
import {
  extractDeterministicRoomSummary,
  semanticAssistFields,
} from "../worker/sale-room-summary-ai.js";

function withoutFound(summary) {
  const { found: _found, ...rest } = summary;
  return rest;
}

test("real case 013: floor-only listing stays roomless and all service evidence is preserved", () => {
  const source = `
🌷30%-12th Mã: 🏆 013

🏢Địa chỉ : Số 26A ngõ 189/93 Nguyễn Ngọc Vũ, Trung Hoà, Cầu

⌛️Trống : tầng 2

☘Giá : 6tr2
☘Dạng phòng : 1n1k
☘Thang : MÁY

🏆Nội thất :  (Đhòa, Nóng lạnh, Giường tủ, VSKK, Tủ bếp, Tủ lạnh...), Máy giặt chung, có thang máy, Cổng vân tay, Camera giám sát, cửa sổ thoáng mát, gần chợ, thuận tiện đi lại,…giới hạn 2xe

🏆Dịch vụ :  4k/số, nước 120k/ng, mạng 100k/phòng, Dịch vụ (Vệ sinh, Thang máy, Máy giặt...): 150k/người, để xe tầng 1 Free
  `;

  const summary = extractDeterministicRoomSummary(source);
  assert.deepEqual(withoutFound(summary), {
    address: "Số 26A ngõ 189/93 Nguyễn Ngọc Vũ, Trung Hoà, Cầu",
    rooms: [{ room: "", price: "6tr2", availability: "" }],
    roomType: "1N1K",
    elevator: "Có",
    furniture: "Điều hòa, nóng lạnh, giường, tủ, tủ bếp, tủ lạnh",
    services: {
      electricity: "4k/số",
      water: "120k/người",
      items: [
        { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
        {
          kind: "common",
          name: "Dịch vụ chung",
          value: "150k/người",
          includes: ["Vệ sinh", "Thang máy", "Máy giặt chung"],
        },
        { kind: "parking", name: "Gửi xe", value: "miễn phí", includes: [] },
      ],
    },
  });
  assert.deepEqual(semanticAssistFields(source, summary), []);
});

test("real case 018: 1N1K never becomes a room and space-separated service units are canonicalized", () => {
  const source = `
🌷50%- 12m Mã: 🏆 018
30%- 6m

🏢Địa chỉ : nhà số 12 ngõ 21 Hoàng Ngọc Phách - Đống Đa

⌛️21/8 Trống : p302

☘Giá : 7tr
☘Dạng phòng : 1n1k
☘Thang : MÁY

🏆Nội thất : Nội thất cơ bản: thang máy, giường, tủ quần áo, bàn trang điểm, sofa, tủ lạnh, điều hòa, nóng lạnh, tủ bếp - bàn bếp, máy giặt máy sấy….

🏆Dịch vụ : Điện 4k 1 số , nước 35k 1 khối , dvc 150k 1 người , mạng 100k 1 phòng
  `;

  const summary = extractDeterministicRoomSummary(source);
  assert.deepEqual(withoutFound(summary), {
    address: "nhà số 12 ngõ 21 Hoàng Ngọc Phách - Đống Đa",
    rooms: [{ room: "p302", price: "7tr", availability: "21/8" }],
    roomType: "1N1K",
    elevator: "Có",
    furniture: "Giường, tủ quần áo, bàn trang điểm, sofa, tủ lạnh, điều hòa, nóng lạnh, tủ bếp, bàn bếp, máy giặt, máy sấy",
    services: {
      electricity: "4k/số",
      water: "35k/khối",
      items: [
        { kind: "common", name: "Dịch vụ chung", value: "150k/người", includes: [] },
        { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
      ],
    },
  });
  assert.deepEqual(semanticAssistFields(source, summary), []);
});

test("real case 042: source numeric amounts are never rounded or given an invented money unit", () => {
  const source = `
🌷30% - hd 30/7/2027 Mã: 🏆 042

🏢Địa chỉ : Số 7C ngách 16 ngõ 75 Hồ Tùng Mậu - Cầu Giấy

⌛️1/9 Trống  : P502-602

☘Giá : 4tr8
🍀Dạng phòng : STUDIO
☘Thang : MÁY

🏆Nội thất : Full đồ, máy giặt riêng

🏆Dịch vụ : Điện 3.990/1 số, nước 35/1 khối, internet + vệ sinh + thang máy 150k/1ng
  `;

  const summary = extractDeterministicRoomSummary(source);
  assert.deepEqual(withoutFound(summary), {
    address: "Số 7C ngách 16 ngõ 75 Hồ Tùng Mậu - Cầu Giấy",
    rooms: [
      { room: "P502", price: "4tr8", availability: "1/9" },
      { room: "602", price: "4tr8", availability: "1/9" },
    ],
    roomType: "Studio",
    elevator: "Có",
    furniture: "Full đồ, máy giặt riêng",
    services: {
      electricity: "3.990/số",
      water: "35/khối",
      items: [
        {
          kind: "common",
          name: "Dịch vụ chung",
          value: "150k/người",
          includes: ["Mạng", "Vệ sinh", "Thang máy"],
        },
      ],
    },
  });
  assert.deepEqual(semanticAssistFields(source, summary), []);
});
