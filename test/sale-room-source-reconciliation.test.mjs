import test from "node:test";
import assert from "node:assert/strict";
import {
  extractSourceRoomMentions,
  normalizeDetectedRooms,
} from "../worker/sale-room-summary-ai.js";

test("source-first reconciliation recovers rooms and facts even when AI omits a room row", () => {
  const source = `
    Địa chỉ: số 38 ngõ 21 Lê Văn Lương - Thanh Xuân
    Trống: 1/9
    Giá: 5tr3-203, 4tr9-p302
  `;

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "203", price: "5tr3", availability: "1/9" },
  ]), [
    { room: "203", price: "5tr3", availability: "1/9" },
    { room: "p302", price: "4tr9", availability: "1/9" },
  ]);
});

test("source room identity treats numeric, P-prefixed and room-labelled forms as aliases", () => {
  const source = `
    Trống: 1/9
    Giá: 4tr9-p302
  `;

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "302", price: "4tr9", availability: "1/9" },
  ]), [
    { room: "p302", price: "4tr9", availability: "1/9" },
  ]);
});

test("source inventory can recover all explicit room-price pairs without AI room rows", () => {
  const roomFirst = `
    Trống: 1/9
    Giá: P301 4tr3 - P501 4tr8
  `;
  assert.deepEqual(normalizeDetectedRooms(roomFirst, []), [
    { room: "P301", price: "4tr3", availability: "1/9" },
    { room: "P501", price: "4tr8", availability: "1/9" },
  ]);

  const priceFirst = `
    Trống: 1/9
    Giá: 4tr3-P301-4tr8-P501
  `;
  assert.deepEqual(normalizeDetectedRooms(priceFirst, []), [
    { room: "P301", price: "4tr3", availability: "1/9" },
    { room: "P501", price: "4tr8", availability: "1/9" },
  ]);
});

test("one clearly scoped price or availability can apply to an entire room group", () => {
  const source = `
    Trống: 1/9-301-501-602
    Giá: 4tr7
  `;

  assert.deepEqual(normalizeDetectedRooms(source, []), [
    { room: "301", price: "4tr7", availability: "1/9" },
    { room: "501", price: "4tr7", availability: "1/9" },
    { room: "602", price: "4tr7", availability: "1/9" },
  ]);
});

test("different facts in the same source scope stay attached to their own rooms", () => {
  const source = `
    Trống: P201 1/9, P202 vào luôn
    Giá: P201 4tr5, P202 4tr8
  `;

  assert.deepEqual(normalizeDetectedRooms(source, []), [
    { room: "P201", price: "4tr5", availability: "1/9" },
    { room: "P202", price: "4tr8", availability: "vào luôn" },
  ]);
});

test("source inventory does not promote address numbers, area or source codes to rooms", () => {
  const source = `
    30% - 12m Mã: 042
    Địa chỉ: Số 302 Mỹ Đình
    Trống: P201
    Giá: 4tr5
  `;

  assert.deepEqual(extractSourceRoomMentions(source), [
    { room: "P201", identity: "number:201" },
  ]);

  assert.deepEqual(normalizeDetectedRooms(source, []), [
    { room: "P201", price: "4tr5", availability: "" },
  ]);
});
