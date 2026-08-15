import test from "node:test";
import assert from "node:assert/strict";
import {
  extractDeterministicRoomSummary,
  reconcileParenthesizedRoomAvailability,
  semanticAssistFields,
} from "../worker/sale-room-summary-ai.js";

test("parenthesized availability stays attached to its immediately preceding room", () => {
  const source = `
    Trống:
    Giá: 6tr8-p203(6/9)
          7tr-p301(31/8)-302(31/8)-501(2/9)-602(ở luôn)
  `;

  const summary = extractDeterministicRoomSummary(source);
  assert.deepEqual(summary.rooms, [
    { room: "p203", price: "6tr8", availability: "6/9" },
    { room: "p301", price: "7tr", availability: "31/8" },
    { room: "302", price: "7tr", availability: "31/8" },
    { room: "501", price: "7tr", availability: "2/9" },
    { room: "602", price: "7tr", availability: "ở luôn" },
  ]);
  assert.equal(semanticAssistFields(source, summary).includes("rooms"), false);
});

test("direct parenthesized evidence overrides a weaker inferred availability", () => {
  assert.deepEqual(reconcileParenthesizedRoomAvailability(
    "Giá: P301(31/8) 7tr",
    [{ room: "P301", price: "7tr", availability: "1/9" }],
  ), [
    { room: "P301", price: "7tr", availability: "31/8" },
  ]);
});
