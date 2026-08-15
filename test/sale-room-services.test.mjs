import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDetectedServices,
  normalizeDetectedServiceRate,
  serviceRateIsGroundedInSource,
} from "../worker/sale-room-summary-ai.js";

test("detects electricity per number and water per cubic meter", () => {
  const source = "Phí dịch vụ: Điện 4k/số. Nước 35k/khối.";

  assert.equal(serviceRateIsGroundedInSource(source, "electricity", "4k/số"), true);
  assert.equal(serviceRateIsGroundedInSource(source, "water", "35k/khối"), true);
  assert.deepEqual(normalizeDetectedServices(source, "4k/số", "35k/khối"), {
    electricity: "4k/số",
    water: "35k/khối",
  });
});

test("normalizes common water unit abbreviations only after grounding them in source", () => {
  const source = "Phí dịch vụ: Điện 4k, nước 135k/ng, dv chung 180k/ng.";

  assert.deepEqual(normalizeDetectedServices(source, "4k", "135k/ng"), {
    electricity: "4k",
    water: "135k/người",
  });
  assert.equal(normalizeDetectedServiceRate(source, "water", "180k/ng"), "");
});

test("keeps electricity and water rates attached to the correct service on one compact line", () => {
  const source = "Dịch vụ điện 4k/số nước 35k/khối";

  assert.equal(serviceRateIsGroundedInSource(source, "electricity", "4k/số"), true);
  assert.equal(serviceRateIsGroundedInSource(source, "water", "35k/khối"), true);
  assert.equal(serviceRateIsGroundedInSource(source, "electricity", "35k/khối"), false);
  assert.equal(serviceRateIsGroundedInSource(source, "water", "4k/số"), false);
});

test("does not invent service units or reuse unrelated listing prices", () => {
  const source = "Giá thuê 4tr5. Điện 4k. Không ghi giá nước.";

  assert.equal(normalizeDetectedServiceRate(source, "electricity", "4k/số"), "");
  assert.equal(normalizeDetectedServiceRate(source, "electricity", "4k"), "4k");
  assert.equal(normalizeDetectedServiceRate(source, "water", "4tr5"), "");
});
