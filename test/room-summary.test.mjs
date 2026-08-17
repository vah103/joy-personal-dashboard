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
  assert.equal(summary.availability, "302, có thể vào ở ngay");
  assert.equal(summary.price, "4tr2");
  assert.equal(summary.roomType, "Studio");
  assert.equal(summary.stairs, "Có");
  assert.match(summary.furniture, /full nội thất/i);
  assert.deepEqual(summary.services.map(({ label, value }) => [label, value]), [
    ["Điện", "4k/số"],
    ["Nước", "100k/người"],
    ["Mạng", "100k/phòng"],
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
  assert.equal(summary.availability, "301, 402");
  assert.equal(summary.price, "301: 3tr8; 402: 4tr2");
  assert.deepEqual(summary.notes, ["Cọc 1 tháng", "Hợp đồng 6 tháng"]);

  const source = await readFile(new URL("../src/pages/sale/room-summary.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|\/api\//);
});

test("parses the labeled TL21House form into a customer-friendly layout", () => {
  const summary = summarizeRoomListing(`
    🌷30% - 12m  Mã: 🏆 007B

    🏢Địa chỉ : SỐ 9 ngõ 63/53 Trần Quốc Vượng- Cầu Giấy

    ⌛️Trống : P201(1/9)

    ☘Giá : 5tr1
    ☘Dạng phòng : studio
    ☘Thang : MÁY

    🏆Nội thất : Full như hình- Máy lọc nước riêng-bếp từ

    🏆Dịch vụ : Điện 4000/số. Nước 35k/m3. Mạng 100k/tháng,dvc 200k/ng,free 1 xe (xe T2 100k)

    ⭐Lưu ý:

    - Đóng 1 cọc 1
    - KHÔNG NHẬN XE ĐIỆN
    - KHÔNG CHUNG CHỦ GIỜ GIẤC TỰ DO
    - QUA HẸN XEM ALO TRƯỚC 30P
    - Nguồn hàng cập nhật liên tục tại
      🏆TL21House🏆
  `);

  assert.equal(summary.address, "Số 9 ngõ 63/53 Trần Quốc Vượng - Cầu Giấy");
  assert.equal(summary.availability, "P201, trống 1/9");
  assert.equal(summary.price, "5tr1/tháng");
  assert.equal(summary.roomType, "Studio");
  assert.equal(summary.stairs, "Có");
  assert.equal(summary.furniture, "Full đồ như hình, máy lọc nước riêng, bếp từ");
  assert.deepEqual(summary.services.map(({ label, value }) => [label, value]), [
    ["Điện", "4k/số"],
    ["Nước", "35k/m³"],
    ["Mạng", "100k/tháng"],
    ["Dịch vụ chung", "200k/người"],
    ["Gửi xe", "Free 1 xe, xe thứ 2 100k"],
  ]);
  assert.deepEqual(summary.notes, [
    "Đóng 1 cọc 1",
    "Không nhận xe điện",
    "Không chung chủ, giờ giấc tự do",
  ]);
  assert.doesNotMatch(JSON.stringify(summary), /30%|007B|TL21House|alo trước 30p|Nguồn hàng/i);
});

test("separates refrigerator fees from parking details", () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: 54 ngõ 66 Hồ Tùng Mậu - Cầu Giấy
    Dịch vụ: Điện 4000/số.Nước 35k/m3. Mạng 100k/tháng,dvc 200k/ng,free 2 xe (xe T3 120k) Tủ Lạnh + 200k
  `);

  assert.deepEqual(summary.services.map(({ label, value }) => [label, value]), [
    ["Điện", "4k/số"],
    ["Nước", "35k/m³"],
    ["Mạng", "100k/tháng"],
    ["Dịch vụ chung", "200k/người"],
    ["Gửi xe", "Free 2 xe, xe thứ 3 120k"],
    ["Tủ lạnh", "200k"],
  ]);
});

test("keeps common-service explanations and recognizes laundry fees", () => {
  const summary = summarizeRoomListing(`
    Địa chỉ: 66 Hồ Tùng Mậu - Cầu Giấy
    Dịch vụ: Điện 4k/số.
    Nước 34k/số.
    Mạng 100k / phòng
    Dịch vụ chung 250k / người ( vệ sinh , rác thải , điện dùng chung)
    Giặt sấy 50k/ng
  `);

  assert.deepEqual(summary.services.map(({ label, value }) => [label, value]), [
    ["Điện", "4k/số"],
    ["Nước", "34k/số"],
    ["Mạng", "100k/phòng"],
    ["Dịch vụ chung", "250k/người (vệ sinh, rác thải, điện dùng chung)"],
    ["Giặt sấy", "50k/người"],
  ]);
});

test("Room Summary is owned by Sale Assistant, not the standalone Sale Manager page", async () => {
  const [salePage, dashboard, assistant, css, source, build] = await Promise.all([
    readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sale/room-summary.css", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sale/room-summary.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(salePage, /id="room-summary-input"/);
  assert.doesNotMatch(salePage, /room-summary\.js/);
  assert.doesNotMatch(salePage, /room-summary\.css/);
  assert.match(dashboard, /room-summary\.css/);
  assert.match(assistant, /data-assistant-mode="summary"/);
  assert.match(assistant, /id="room-summary-input"/);
  assert.match(assistant, /id="room-summary-capture-button"/);
  assert.match(css, /\.sale-room-capture/);
  assert.match(css, /\.room-share-detail-row/);
  assert.match(source, /appendDetailRow\(details, "Phòng trống"/);
  assert.match(source, /renderListSection\(container, "Dịch vụ"/);
  assert.match(build, /room-summary\.js/);
  assert.match(build, /room-summary\.css/);
});
