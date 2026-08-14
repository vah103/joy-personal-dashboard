import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDetectedRooms,
  roomFieldIsAssociatedInSource,
} from "../worker/sale-room-summary-ai.js";

const groupedRooms = ["301", "501", "602"];

test("one availability before a room group applies to every room in that scope", () => {
  const source = "Trống: 1/9-301-501-602";

  for (const room of groupedRooms) {
    assert.equal(
      roomFieldIsAssociatedInSource(source, room, "1/9", groupedRooms, "availability"),
      true,
    );
  }

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "301", price: "", availability: "1/9" },
    { room: "501", price: "", availability: "1/9" },
    { room: "602", price: "", availability: "1/9" },
  ]), [
    { room: "301", price: "", availability: "1/9" },
    { room: "501", price: "", availability: "1/9" },
    { room: "602", price: "", availability: "1/9" },
  ]);
});

test("one availability after a room group has the same group scope", () => {
  const source = "Trống: 301-501-602-1/9";

  for (const room of groupedRooms) {
    assert.equal(
      roomFieldIsAssociatedInSource(source, room, "1/9", groupedRooms, "availability"),
      true,
    );
  }
});

test("backend fills a clearly grouped availability when AI only emits it once", () => {
  const source = `
    Trống: 1/9-301-501-602
    Giá: 4tr7
  `;

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "301", price: "4tr7", availability: "1/9" },
    { room: "501", price: "4tr7", availability: "" },
    { room: "602", price: "4tr7", availability: "" },
  ]), [
    { room: "301", price: "4tr7", availability: "1/9" },
    { room: "501", price: "4tr7", availability: "1/9" },
    { room: "602", price: "4tr7", availability: "1/9" },
  ]);
});

test("different room availabilities are not broadcast across the group", () => {
  const source = "Trống: P201 1/9, P202 vào luôn";
  const rooms = ["P201", "P202"];

  assert.equal(
    roomFieldIsAssociatedInSource(source, "P201", "1/9", rooms, "availability"),
    true,
  );
  assert.equal(
    roomFieldIsAssociatedInSource(source, "P202", "vào luôn", rooms, "availability"),
    true,
  );
  assert.equal(
    roomFieldIsAssociatedInSource(source, "P202", "1/9", rooms, "availability"),
    false,
  );
  assert.equal(
    roomFieldIsAssociatedInSource(source, "P201", "vào luôn", rooms, "availability"),
    false,
  );

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "P201", price: "", availability: "1/9" },
    { room: "P202", price: "", availability: "vào luôn" },
  ]), [
    { room: "P201", price: "", availability: "1/9" },
    { room: "P202", price: "", availability: "vào luôn" },
  ]);
});
