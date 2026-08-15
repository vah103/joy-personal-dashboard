import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  extractDeterministicRoomSummary,
  semanticAssistFields,
} from "../worker/sale-room-summary-ai.js";

test("Room Summary is rules-first and skips AI for a fully structured listing", () => {
  const source = `
    Địa chỉ: 105 Doãn Kế Thiện
    Trống: P201 1/9
    Giá: P201 4tr5
    Dạng phòng: Studio
    Thang: MÁY
    Nội thất: giường, tủ, điều hòa
    Điện 4k/số
    Nước 35k/khối
    Mạng 100k/phòng
  `;

  const summary = extractDeterministicRoomSummary(source);
  assert.equal(summary.address, "105 Doãn Kế Thiện");
  assert.deepEqual(summary.rooms, [
    { room: "P201", price: "4tr5", availability: "1/9" },
  ]);
  assert.equal(summary.roomType, "Studio");
  assert.equal(summary.elevator, "Có");
  assert.equal(summary.furniture, "Giường, tủ, điều hòa");
  assert.deepEqual(summary.services, {
    electricity: "4k/số",
    water: "35k/khối",
    items: [
      { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
    ],
  });
  assert.deepEqual(semanticAssistFields(source, summary), []);
});

test("Room Summary asks semantic AI only for unresolved groups", () => {
  const source = `
    Địa chỉ: 12 Trần Thái Tông
    Phòng P201 giá 4tr5
    Phí dọn phòng 70k/tháng
  `;
  assert.deepEqual(semanticAssistFields(source), ["services"]);
});

test("Room Summary backend has one optional semantic AI call and no legacy split modules", async () => {
  const backend = await readFile(
    new URL("../worker/sale-room-summary-ai.js", import.meta.url),
    "utf8",
  );

  assert.equal((backend.match(/env\.AI\.run/gu) || []).length, 1);
  assert.match(backend, /extractDeterministicRoomSummary/u);
  assert.match(backend, /semanticAssistFields/u);
  assert.match(backend, /runSemanticAssist/u);
  assert.match(backend, /max_tokens:\s*2000/u);
  assert.doesNotMatch(backend, /sale-room-summary-ai-core/u);
  assert.doesNotMatch(backend, /sale-room-service-items-ai/u);
  assert.doesNotMatch(backend, /sale-room-service-source-reconciliation/u);
});

test("Room Summary frontend bounds request latency and cancels obsolete requests", async () => {
  const frontend = await readFile(
    new URL("../src/pages/sale/room-address-ai.js", import.meta.url),
    "utf8",
  );

  assert.match(frontend, /ROOM_SUMMARY_REQUEST_TIMEOUT_MS = 20000/u);
  assert.match(frontend, /new AbortController\(\)/u);
  assert.match(frontend, /signal,/u);
  assert.match(frontend, /activeRequestController\?\.abort\(\)/u);
  assert.match(frontend, /window\.setTimeout\(\(\) => controller\.abort\(\), ROOM_SUMMARY_REQUEST_TIMEOUT_MS\)/u);
});
