import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseJoyRoomText } from "../src/pages/sale/room-address-ai.js";

function sourceWithServices(lines) {
  return `
Địa chỉ: 12 phố A
Phòng:
- P401 | 3tr | 1/9
Dạng phòng: Studio
Thang máy: Có
Nội thất: Như hình
Dịch vụ:
${lines}
Lưu ý:
`;
}

test("raw service prose is rejected instead of being recovered by frontend fallback", () => {
  const raw = `
Địa chỉ: 12 phố A
Phòng P401 giá 3tr
Dịch vụ: Điện 4k, nước 135k/ng, dv chung 180k/ng
`;
  assert.equal(parseJoyRoomText(raw), null);
});

test("Joy Room Text preserves prepared electricity and water units", () => {
  const summary = parseJoyRoomText(sourceWithServices("- Điện: 4k/số\n- Nước: 35k/khối"));
  assert.equal(summary.services.electricity, "4k/số");
  assert.equal(summary.services.water, "35k/khối");
});

test("Joy Room Text preserves numeric service amounts exactly", () => {
  const summary = parseJoyRoomText(sourceWithServices("- Điện: 3.990/số\n- Nước: 35/khối"));
  assert.equal(summary.services.electricity, "3.990/số");
  assert.equal(summary.services.water, "35/khối");
});

test("Joy Room Text keeps dynamic service items and bundle includes", () => {
  const summary = parseJoyRoomText(sourceWithServices(
    "- Điện: 4k/số\n- Nước: 35k/khối\n- Mạng: 100k/phòng\n- Dịch vụ chung: 150k/người | Gồm: Mạng, vệ sinh, thang máy",
  ));
  assert.deepEqual(summary.services.items, [
    { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
    { kind: "common", name: "Dịch vụ chung", value: "150k/người", includes: ["Mạng", "vệ sinh", "thang máy"] },
  ]);
});

test("renders electricity and water as bullet items under the service heading", async () => {
  const frontend = await readFile(new URL("../src/pages/sale/room-address-ai.js", import.meta.url), "utf8");
  assert.match(frontend, /className = "room-share-service-group"/u);
  assert.match(frontend, /list\.className = "room-share-services"/u);
  assert.match(frontend, /appendDynamicServiceItem/u);
});

test("missing electricity or water stays missing instead of being inferred", () => {
  const summary = parseJoyRoomText(sourceWithServices("- Dịch vụ chung: 180k/người\n- Mạng: 100k/phòng"));
  assert.equal(summary.services.electricity, "");
  assert.equal(summary.services.water, "");
});
