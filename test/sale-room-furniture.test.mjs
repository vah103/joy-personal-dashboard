import test from "node:test";
import assert from "node:assert/strict";
import {
  furnitureReferencesImage,
  normalizeDetectedFurniture,
} from "../worker/sale-room-summary-ai.js";

test("recognizes explicit furniture-as-image wording", () => {
  assert.equal(furnitureReferencesImage("Nội thất: Full đồ như ảnh"), true);
  assert.equal(furnitureReferencesImage("Đồ đạc như hình"), true);
  assert.equal(furnitureReferencesImage("Có ảnh phòng, nội thất gồm giường và tủ"), false);

  assert.equal(
    normalizeDetectedFurniture("Nội thất: Full đồ như ảnh", ["giường", "tủ"], true),
    "Như hình",
  );
});

test("AI can semantically separate grounded furniture items from compact source wording", () => {
  const source = "Nội thất: giường tủ điều hòa nóng lạnh";
  assert.equal(
    normalizeDetectedFurniture(source, ["giường", "tủ", "điều hòa", "nóng lạnh"], false),
    "Giường, Tủ, Điều hòa, Nóng lạnh",
  );
});

test("normalizes common furniture wording while keeping it grounded", () => {
  const source = "Có tủ áo, bình nóng lạnh, bếp từ, máy giặt";
  assert.equal(
    normalizeDetectedFurniture(source, ["tủ áo", "bình nóng lạnh", "bếp từ", "máy giặt"], false),
    "Tủ quần áo, Nóng lạnh, Bếp từ, Máy giặt",
  );
});

test("drops hallucinated or non-furniture items", () => {
  const source = "Nội thất: giường, điều hòa. Dịch vụ: điện, nước, mạng.";
  assert.equal(
    normalizeDetectedFurniture(source, ["giường", "điều hòa", "tủ lạnh", "điện", "nước", "mạng"], false),
    "Giường, Điều hòa",
  );
});

test("does not trust furnitureAsImage when the source does not say image or photo", () => {
  const source = "Nội thất: giường, tủ";
  assert.equal(normalizeDetectedFurniture(source, [], true), "");
});
