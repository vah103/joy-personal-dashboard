import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { summarizeRoomListing } from "../src/pages/sale/room-summary.js";

test("creates a clean customer room summary without private sale details", () => {
  const summary = summarizeRoomListing(`
    180 Phú Mỹ còn phòng 302 giá 4tr2, vào luôn
    Studio, full nội thất, thang máy
    Điện 4k nước 100k/người wifi 100k/phòng gửi xe 100k/xe
    Cọc 1 tháng; SĐT 0987654321; hoa hồng 50%; nguồn chị Lan
  `);

  assert.equal(summary.address, "180 Phú Mỹ");
  assert.deepEqual(summary.rooms, [{ title: "Phòng 302", price: "4tr2", note: "Có thể vào ở ngay" }]);
  assert.equal(summary.roomType, "Studio");
  assert.equal(summary.stairs, "Thang máy");
  assert.match(summary.furniture, /full nội thất/i);
  assert.deepEqual(summary.services.map(({ label, value }) => [label, value]), [
    ["Điện", "4k"],
    ["Nước", "100k/người"],
    ["Internet", "100k/phòng"],
    ["Gửi xe", "100k/xe"],
  ]);
  assert.deepEqual(summary.notes, ["Cọc 1 tháng"]);
  assert.doesNotMatch(JSON.stringify(summary), /0987654321|hoa hồng|chị Lan/i);
});

test("supports several available rooms and keeps the result temporary", async () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: 25 ngõ 10 Mỹ Đình
    Còn P301 3tr8, P402 4tr2
    Nội thất: điều hòa, nóng lạnh, giường tủ
    Điện 4k; nước 100k/ng; wifi 100k; xe 100k
    Cọc 1 tháng, hợp đồng 6 tháng
  `);

  assert.deepEqual(summary.rooms.map(({ title, price }) => [title, price]), [
    ["Phòng 301", "3tr8"],
    ["Phòng 402", "4tr2"],
  ]);
  assert.deepEqual(summary.notes, ["Cọc 1 tháng", "hợp đồng 6 tháng"]);

  const source = await readFile(new URL("../src/pages/sale/room-summary.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|\/api\//);
});

test("Sale page exposes one screenshot-focused room summary interface", async () => {
  const [html, css, build] = await Promise.all([
    readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sale/room-summary.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(html, /id="room-summary-input"/);
  assert.match(html, /id="room-summary-capture-button"/);
  assert.match(html, /Temporary · never saved/);
  assert.match(css, /\.sale-room-capture/);
  assert.match(build, /room-summary\.js/);
  assert.match(build, /room-summary\.css/);
});
