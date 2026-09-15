import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatRoomSummaryDisplayLine,
  splitRoomSummaryLine,
  summarizeRoomListing,
} from "../src/pages/sale/room-summary.js";

const SAMPLE = `Địa chỉ: Số 10 ngõ 71 Mỹ Đình - Nam Từ Liêm

Phòng trống: P101A – vào ở từ 01/10/2026

Giá: 3tr9/tháng
Dạng phòng: Studio – 26m²
Thang: Máy

Nội thất: Điều hòa, nóng lạnh, bàn tủ bếp, giường, tủ, đệm, bàn ghế, giá giày

* Thêm máy giặt: 300k/tháng

Dịch vụ:

* Điện: 4k/số
* Nước: 120k/người hoặc 35k/khối nếu có đồng hồ riêng
* Dịch vụ chung: 200k/người
* Trẻ em dưới 10 tuổi: 100k/người

Lưu ý:

* Đóng 1 cọc 1
* Tối đa 3 người, 2 xe
* Nhà có bảo vệ: 100k/xe máy`;

test("Room Summary preserves the source text and line order", () => {
  const summary = summarizeRoomListing(SAMPLE);

  assert.equal(summary.text, SAMPLE);
  assert.deepEqual(summary.lines, SAMPLE.split("\n"));
  assert.equal(summary.isEmpty, false);
});

test("Room Summary normalizes only CRLF line endings", () => {
  const source = "Địa chỉ: A\r\n\r\n* Điện: 4k/số\r\nSĐT: 0987654321";
  const summary = summarizeRoomListing(source);

  assert.equal(summary.text, "Địa chỉ: A\n\n* Điện: 4k/số\nSĐT: 0987654321");
  assert.match(summary.text, /0987654321/);
});

test("Room Summary renders leading asterisk markers as round bullets only", () => {
  assert.equal(formatRoomSummaryDisplayLine("* Điện: 4k/số"), "• Điện: 4k/số");
  assert.equal(formatRoomSummaryDisplayLine("*"), "•");
  assert.equal(formatRoomSummaryDisplayLine("Giá: 3tr9*2"), "Giá: 3tr9*2");
  assert.equal(formatRoomSummaryDisplayLine("  * Điện: 4k/số"), "  * Điện: 4k/số");
});

test("only a label beginning at the absolute start of a line is a bold candidate", () => {
  assert.deepEqual(splitRoomSummaryLine("Địa chỉ: Số 10"), {
    label: "Địa chỉ:",
    rest: " Số 10",
  });
  assert.deepEqual(splitRoomSummaryLine("Dịch vụ:"), {
    label: "Dịch vụ:",
    rest: "",
  });
  assert.deepEqual(splitRoomSummaryLine("* Điện: 4k/số"), {
    label: "",
    rest: "* Điện: 4k/số",
  });
  assert.deepEqual(splitRoomSummaryLine("- Nước: 35k/khối"), {
    label: "",
    rest: "- Nước: 35k/khối",
  });
  assert.deepEqual(splitRoomSummaryLine("• Mạng: 100k/phòng"), {
    label: "",
    rest: "• Mạng: 100k/phòng",
  });
  assert.deepEqual(splitRoomSummaryLine("  Giá: 3tr9"), {
    label: "",
    rest: "  Giá: 3tr9",
  });
  assert.deepEqual(splitRoomSummaryLine("1. Giá: 3tr9"), {
    label: "",
    rest: "1. Giá: 3tr9",
  });
});

test("the approved sample bolds only top-level labels", () => {
  const summary = summarizeRoomListing(SAMPLE);
  const boldLabels = summary.lines
    .map(splitRoomSummaryLine)
    .filter(({ label }) => label)
    .map(({ label }) => label);

  assert.deepEqual(boldLabels, [
    "Địa chỉ:",
    "Phòng trống:",
    "Giá:",
    "Dạng phòng:",
    "Thang:",
    "Nội thất:",
    "Dịch vụ:",
    "Lưu ý:",
  ]);
});

test("Sale Assistant owns the literal screenshot formatter while Sale Manager stays deal-only", async () => {
  const [managerHtml, assistant, source, build, bootstrap, i18n] = await Promise.all([
    readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sale/room-summary.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/app-bootstrap.js", import.meta.url), "utf8"),
    readFile(new URL("../src/i18n/index.js", import.meta.url), "utf8"),
  ]);

  assert.match(assistant, /id="room-summary-input"/);
  assert.match(assistant, /id="room-summary-capture-button"/);
  assert.match(assistant, /data-assistant-panel="summary"/);
  assert.doesNotMatch(managerHtml, /id="room-summary-input"/);
  assert.match(source, /LEADING_LABEL_PATTERN/);
  assert.match(source, /room-share-plain-line/);
  assert.match(source, /formatRoomSummaryDisplayLine/);
  assert.match(source, /container\.dataset\.i18nSkip = "true"/);
  assert.match(i18n, /\[data-i18n-skip\]/);
  assert.doesNotMatch(source, /extractServices|normalizePrice|stripInternalDetails/);
  assert.doesNotMatch(bootstrap, /SALE_ROOM_SUMMARY_AI_ENDPOINT|runSaleRoomAiPolish|room-summary\/polish/);
  assert.match(build, /room-summary\.js/);
});
