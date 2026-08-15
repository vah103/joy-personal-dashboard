import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canonicalElevator,
  elevatorStatusInSource,
  normalizeDetectedElevator,
} from "../worker/sale-room-summary-ai.js";

test("normalizes elevator output to Có or Không only", () => {
  assert.equal(canonicalElevator("Có"), "Có");
  assert.equal(canonicalElevator("có thang máy"), "Có");
  assert.equal(canonicalElevator("Không"), "Không");
  assert.equal(canonicalElevator("thang bộ"), "Không");
  assert.equal(canonicalElevator("có thể có"), "");
});

test("reads explicit elevator status from common Sale source formats", () => {
  assert.equal(elevatorStatusInSource("☘Thang : MÁY"), "Có");
  assert.equal(elevatorStatusInSource("Có thang máy"), "Có");
  assert.equal(elevatorStatusInSource("Thang máy: không"), "Không");
  assert.equal(elevatorStatusInSource("Không có thang máy"), "Không");
  assert.equal(elevatorStatusInSource("Thang: BỘ"), "Không");
});

test("does not guess elevator status when the source is silent or contradictory", () => {
  assert.equal(elevatorStatusInSource("Phòng P502 tầng 5, giá 6tr5"), "");
  assert.equal(elevatorStatusInSource("Có thang máy. Ghi chú khác: thang bộ"), "");
});

test("rejects an AI elevator answer that conflicts with the source", () => {
  assert.equal(normalizeDetectedElevator("Thang: MÁY", "Có"), "Có");
  assert.equal(normalizeDetectedElevator("Thang: MÁY", "Không"), "");
  assert.equal(normalizeDetectedElevator("Không có thang máy", "Không"), "Không");
  assert.equal(normalizeDetectedElevator("Không có thang máy", "Có"), "");
  assert.equal(normalizeDetectedElevator("Không nhắc thông tin này", "Có"), "");
});

test("Joy Room Text renders elevator after room type", async () => {
  const frontend = await readFile(
    new URL("../src/pages/sale/room-address-ai.js", import.meta.url),
    "utf8",
  );

  assert.match(frontend, /appendRoomType\(details, summary\.roomType\);\s*appendElevator\(details, summary\.elevator\);/s);
  assert.match(frontend, /elevator: sections\.elevator\.join\(" "\)\.trim\(\)/u);
  assert.match(frontend, /appendLabeledValue\(details, \["Thang", " máy"\], elevator\)/u);
});
