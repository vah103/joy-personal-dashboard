import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalRoomType,
  normalizeDetectedRoomType,
} from "../worker/sale-room-summary-ai.js";

test("room type uses only the agreed canonical options", () => {
  assert.equal(canonicalRoomType("đơn"), "Đơn");
  assert.equal(canonicalRoomType("ĐƠN"), "Đơn");
  assert.equal(canonicalRoomType("gác xép"), "Gác xép");
  assert.equal(canonicalRoomType("GÁC XÉP"), "Gác xép");
  assert.equal(canonicalRoomType("studio"), "Studio");
  assert.equal(canonicalRoomType("STUDIO"), "Studio");
  assert.equal(canonicalRoomType("stuido"), "Studio");
  assert.equal(canonicalRoomType("1n1k"), "1N1K");
  assert.equal(canonicalRoomType("2N1K"), "2N1K");
  assert.equal(canonicalRoomType("3 n 1 k"), "3N1K");
  assert.equal(canonicalRoomType("12N1K"), "12N1K");

  assert.equal(canonicalRoomType("Duplex"), "");
  assert.equal(canonicalRoomType("1N2K"), "");
  assert.equal(canonicalRoomType("căn hộ dịch vụ"), "");
});

test("room type must be supported by the pasted source", () => {
  assert.equal(normalizeDetectedRoomType("Dạng phòng: đơn", "Đơn"), "Đơn");
  assert.equal(normalizeDetectedRoomType("Dạng phòng: 2n1k", "2N1K"), "2N1K");
  assert.equal(normalizeDetectedRoomType("Dạng phòng: STUIDO", "Studio"), "Studio");
  assert.equal(normalizeDetectedRoomType("Dạng phòng: gác xép", "Gác xép"), "Gác xép");
  assert.equal(normalizeDetectedRoomType("Dạng phòng: đơn", "Studio"), "");
  assert.equal(normalizeDetectedRoomType("Dạng phòng: 2N1K", "Studio"), "");
});

test("ambiguous listings with several room types are not collapsed into one type", () => {
  const source = "Tòa có Studio và 2N1K. Phòng P502 đang trống.";
  assert.equal(normalizeDetectedRoomType(source, "Studio"), "");
  assert.equal(normalizeDetectedRoomType(source, "2N1K"), "");
});
