import test from "node:test";
import assert from "node:assert/strict";
import {
  extractSourceDynamicServiceItems,
  reconcileDynamicServiceItems,
} from "../worker/sale-room-summary-ai.js";

test("source-first service reconciliation recovers a common package when AI returns no items", () => {
  const source = "DV chung 180k/ng gồm vệ sinh, rác, mạng, điện chung, máy giặt.";

  assert.deepEqual(reconcileDynamicServiceItems(source, []), [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/người",
      includes: ["Mạng", "Vệ sinh", "Rác", "Máy giặt chung", "Điện chung"],
    },
  ]);
});

test("generic service fee directly followed by a rate is treated as a common fee", () => {
  const source = "Dịch vụ: 150k/ng gồm mạng, vệ sinh, máy giặt chung.";

  assert.deepEqual(extractSourceDynamicServiceItems(source), [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "150k/người",
      includes: ["Mạng", "Vệ sinh", "Máy giặt chung"],
    },
  ]);
});

test("a service heading before electricity and water is not invented as a common fee", () => {
  const source = "Phí dịch vụ: Điện 4k/số, nước 35k/khối.";
  assert.deepEqual(extractSourceDynamicServiceItems(source), []);
});

test("source-first fallback also recovers independently priced known services", () => {
  const source = "Mạng 100k/phòng; gửi xe 80k/xe; máy giặt chung 50k/ng.";

  assert.deepEqual(extractSourceDynamicServiceItems(source), [
    { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
    { kind: "parking", name: "Gửi xe", value: "80k/xe", includes: [] },
    { kind: "washing", name: "Máy giặt chung", value: "50k/người", includes: [] },
  ]);
});

test("AI and source candidates merge without duplicating the same common package", () => {
  const source = "DV chung 180k/ng gồm vệ sinh, mạng, máy giặt.";

  assert.deepEqual(reconcileDynamicServiceItems(source, [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/người",
      includes: ["Vệ sinh"],
    },
  ]), [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/người",
      includes: ["Mạng", "Vệ sinh", "Máy giặt chung"],
    },
  ]);
});
