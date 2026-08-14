import test from "node:test";
import assert from "node:assert/strict";
import {
  extractSourceDynamicServiceItems,
  extractSourceRoomMentions,
  normalizeDynamicServiceItems,
  reconcileDynamicServiceItems,
} from "../worker/sale-room-summary-ai.js";

test("service corpus: generic fee plus an explicit member list is one common package", () => {
  assert.deepEqual(extractSourceDynamicServiceItems(
    "Dịch vụ: 150k/ng gồm mạng, vệ sinh, máy giặt chung.",
  ), [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "150k/người",
      includes: ["Mạng", "Vệ sinh", "Máy giặt chung"],
    },
  ]);
});

test("service corpus: member-first bundle with one rate is one package", () => {
  assert.deepEqual(extractSourceDynamicServiceItems(
    "Mạng + vệ sinh + máy giặt chung 150k/phòng",
  ), [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "150k/phòng",
      includes: ["Mạng", "Vệ sinh", "Máy giặt chung"],
    },
  ]);
});

test("service corpus: reverse rate-label ordering remains independently scoped", () => {
  assert.deepEqual(extractSourceDynamicServiceItems(
    "100k/phòng mạng; 80k/xe gửi xe",
  ), [
    { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
    { kind: "parking", name: "Gửi xe", value: "80k/xe", includes: [] },
  ]);
});

test("service corpus: a generic service heading cannot steal a utility-specific rate", () => {
  const items = extractSourceDynamicServiceItems(
    "Phí dịch vụ: 4k/số điện, nước 35k/khối",
  );
  assert.equal(items.some((item) => item.kind === "common"), false);
});

test("service corpus: one shared electricity-water rate stays one semantic item", () => {
  assert.deepEqual(extractSourceDynamicServiceItems("Điện nước 100k/ng"), [
    { kind: "other", name: "Điện + nước", value: "100k/người", includes: [] },
  ]);
});

test("service corpus: Vietnamese AI evidence keeps full units and free status", () => {
  const source = "Dịch vụ chung 180k/ng gồm điện chung, mạng. Wifi miễn phí.";
  assert.deepEqual(normalizeDynamicServiceItems(source, [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/ng",
      includes: ["điện chung", "mạng"],
      evidence: "Dịch vụ chung 180k/ng gồm điện chung, mạng",
    },
    {
      kind: "internet",
      name: "Wifi",
      value: "miễn phí",
      includes: [],
      evidence: "Wifi miễn phí",
    },
  ]), [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/người",
      includes: ["Điện chung", "Mạng"],
    },
    { kind: "internet", name: "Mạng", value: "miễn phí", includes: [] },
  ]);
});

test("service corpus: source-grounded fee wins over a conflicting AI fee for the same service", () => {
  assert.deepEqual(reconcileDynamicServiceItems("Mạng 100k/phòng", [
    { kind: "internet", name: "Mạng", value: "80k/phòng", includes: [] },
  ]), [
    { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
  ]);
});

test("room corpus: percentage, commission, deposit and source code never become rooms", () => {
  assert.deepEqual(extractSourceRoomMentions(
    "Giá 4tr5, HH 30%, Mã 042, cọc 1000",
  ), []);
});

test("room corpus: price-room pairs recover numeric and P-prefixed room aliases", () => {
  assert.deepEqual(extractSourceRoomMentions(
    "Giá: 5tr3-203, 4tr9-p302",
  ).map((item) => item.room), ["203", "p302"]);
});

test("room corpus: grouped availability inventories every room in the group", () => {
  assert.deepEqual(extractSourceRoomMentions(
    "Trống: 1/9-301-501-602",
  ).map((item) => item.room), ["301", "501", "602"]);
});

test("room corpus: a P-prefixed room gives confidence to adjacent grouped bare rooms", () => {
  assert.deepEqual(extractSourceRoomMentions(
    "Giá: 4tr3-p301-501",
  ).map((item) => item.room), ["p301", "501"]);
});
