import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDetectedRooms,
  roomFieldIsAssociatedInSource,
} from "../worker/sale-room-summary-ai.js";

test("one grouped price applies to every room even when AI leaves one price blank", () => {
  const source = `
    Trống: 1/9
    Giá: 4tr3-p301-501
  `;

  assert.equal(roomFieldIsAssociatedInSource(source, "p301", "4tr3", ["p301", "501"], "price"), true);
  assert.equal(roomFieldIsAssociatedInSource(source, "501", "4tr3", ["p301", "501"], "price"), true);

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "p301", price: "4tr3", availability: "1/9" },
    { room: "501", price: "", availability: "1/9" },
  ]), [
    { room: "p301", price: "4tr3", availability: "1/9" },
    { room: "501", price: "4tr3", availability: "1/9" },
  ]);
});

test("separate room prices stay isolated and source reconciliation recovers an AI omission", () => {
  const source = "Giá: P301 4tr3 - P501 4tr8";

  assert.equal(roomFieldIsAssociatedInSource(source, "P301", "4tr3", ["P301", "P501"], "price"), true);
  assert.equal(roomFieldIsAssociatedInSource(source, "P501", "4tr8", ["P301", "P501"], "price"), true);
  assert.equal(roomFieldIsAssociatedInSource(source, "P501", "4tr3", ["P301", "P501"], "price"), false);

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "P301", price: "4tr3", availability: "" },
    { room: "P501", price: "", availability: "" },
  ]), [
    { room: "P301", price: "4tr3", availability: "" },
    { room: "P501", price: "4tr8", availability: "" },
  ]);
});

test("separate prices also pair correctly when price is written before each room", () => {
  const source = "Giá: 4tr3-P301-4tr8-P501";

  assert.equal(roomFieldIsAssociatedInSource(source, "P301", "4tr3", ["P301", "P501"], "price"), true);
  assert.equal(roomFieldIsAssociatedInSource(source, "P501", "4tr8", ["P301", "P501"], "price"), true);
  assert.equal(roomFieldIsAssociatedInSource(source, "P501", "4tr3", ["P301", "P501"], "price"), false);
});
