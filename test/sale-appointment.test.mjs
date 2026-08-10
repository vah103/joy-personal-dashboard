import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatVietnamViewingTime,
  parseSaleAppointmentInput,
} from "../src/features/sales/sale-appointment.js";
import {
  formatSheetViewingTime,
  googleSheetsViewingSerial,
  isSaleViewingCreateRoute,
  validateSaleViewingInput,
  viewingDaySeparatorIndexes,
} from "../worker/sale-viewing-create.js";

const NOW = Date.parse("2026-07-27T02:00:00.000Z"); // 09:00 in Vietnam

test("parses a Vietnamese viewing appointment for tomorrow evening", () => {
  const parsed = parseSaleAppointmentInput(
    "8h tối mai chị Lan 0987 654 321 xem phòng 180 Phú Mỹ",
    NOW,
  );

  assert.equal(parsed.customerName, "chị Lan");
  assert.equal(parsed.phone, "0987654321");
  assert.equal(parsed.viewingAddress, "180 Phú Mỹ");
  assert.equal(parsed.viewingAt, "2026-07-28T13:00:00.000Z");
  assert.equal(parsed.valid, true);
  assert.equal(formatVietnamViewingTime(parsed.viewingAt), "Th 3, 28/07/2026 · 20:00");
});

test("parses relative appointments and treats giờ khách qua as now", () => {
  const relative = parseSaleAppointmentInput(
    "30p nữa anh Nam 0912345678 xem phòng 25 ngõ 10 Mỹ Đình",
    NOW,
  );
  assert.equal(relative.customerName, "anh Nam");
  assert.equal(relative.viewingAt, "2026-07-27T02:30:00.000Z");

  const immediate = parseSaleAppointmentInput(
    "chị Mai 0901234567 giờ khách qua xem phòng 12 Cầu Giấy",
    NOW,
  );
  assert.equal(immediate.customerName, "chị Mai");
  assert.equal(immediate.viewingAt, "2026-07-27T02:00:00.000Z");
  assert.equal(immediate.viewingAddress, "12 Cầu Giấy");
});

test("matches GPT Sale defaults for dayparts and unnamed customers", () => {
  const morning = parseSaleAppointmentInput(
    "Sáng mai khách xem phòng 180 Phú Mỹ",
    NOW,
  );
  assert.equal(morning.viewingAt, "2026-07-28T02:00:00.000Z");

  const immediate = parseSaleAppointmentInput(
    "Giờ bạn qua xem phòng 180 Phú Mỹ ạ",
    NOW,
  );
  assert.equal(immediate.customerName, "Khách xem phòng 180 Phú Mỹ");
  assert.equal(immediate.viewingAddress, "180 Phú Mỹ");
  assert.equal(immediate.viewingAt, "2026-07-27T02:00:00.000Z");
});

test("finds an absolute time even when the phone number comes first", () => {
  const parsed = parseSaleAppointmentInput(
    "chị Hương 0988123456 mai 9h30 sáng xem phòng 45 Trần Bình",
    NOW,
  );
  assert.equal(parsed.customerName, "chị Hương");
  assert.equal(parsed.viewingAt, "2026-07-28T02:30:00.000Z");
  assert.equal(parsed.viewingAddress, "45 Trần Bình");
});

test("parses labeled multiline Sale forms without treating the source as the customer", () => {
  const parsed = parseSaleAppointmentInput(`
    🏆TL21House🏆
    🍀Địa chỉ : 66 hồ tùng mậu
    🍀Giá : 4tr5
    🍀Sđt : 0366823628
    🍀Thời gian xem : chiều mai
    🍀CTV : Vanh
    🍀MÃ PHÒNG : 590
  `, NOW);

  assert.equal(parsed.customerName, "Khách 0366823628");
  assert.equal(parsed.phone, "0366823628");
  assert.equal(parsed.viewingAddress, "66 hồ tùng mậu");
  assert.equal(parsed.viewingAt, "2026-07-28T08:00:00.000Z");
  assert.deepEqual(parsed.missing, []);
  assert.equal(parsed.valid, true);
});

test("uses a leading standalone customer name before the Sale source header", () => {
  const parsed = parseSaleAppointmentInput(`
    Thùy Dương
    🏆TL21House🏆
    🍀Địa chỉ : 66 hồ tùng mậu
    🍀Giá : 4tr5
    🍀Sđt : 0366823628
    🍀Thời gian xem : chiều mai
    🍀CTV : Vanh
  `, NOW);

  assert.equal(parsed.customerName, "Thùy Dương");
  assert.equal(parsed.phone, "0366823628");
  assert.equal(parsed.viewingAddress, "66 hồ tùng mậu");
  assert.equal(parsed.viewingAt, "2026-07-28T08:00:00.000Z");
  assert.equal(parsed.valid, true);
});

test("prefers an explicit customer label in multiline Sale forms", () => {
  const parsed = parseSaleAppointmentInput(`
    Tên khách: chị Lan
    Địa chỉ xem phòng: 180 Phú Mỹ
    Số điện thoại: 0987654321
    Thời gian xem: mai 8h tối
  `, NOW);

  assert.equal(parsed.customerName, "chị Lan");
  assert.equal(parsed.phone, "0987654321");
  assert.equal(parsed.viewingAddress, "180 Phú Mỹ");
  assert.equal(parsed.viewingAt, "2026-07-28T13:00:00.000Z");
  assert.equal(parsed.valid, true);
});

test("validates normal appointments with pending reminder states", () => {
  const validation = validateSaleViewingInput({
    customerName: " Chị Lan ",
    phone: "0987 654 321",
    viewingAddress: "180 Phú Mỹ",
    viewingAt: "2026-07-28T13:00:00.000Z",
  }, NOW);

  assert.equal(validation.error, undefined);
  assert.equal(validation.value.customerName, "Chị Lan");
  assert.equal(validation.value.phone, "0987654321");
  assert.equal(validation.value.viewingTime, "28/07/2026 20:00");
  assert.equal(validation.value.shortNoticeAppointment, false);
  assert.equal(validation.value.beforeStatus, "EMAIL_MODE=NORMAL; BEFORE_PENDING");
  assert.equal(validation.value.afterStatus, "AFTER_PENDING");
  assert.match(validation.value.reminderMessage, /nhắc đúng giờ xem/);
  assert.equal(formatSheetViewingTime("2026-07-28T13:00:00.000Z"), "28/07/2026 20:00");
});

test("stores ambiguous August dates as locale-independent Google Sheets serials", () => {
  assert.equal(
    googleSheetsViewingSerial("2026-08-10T08:00:00.000Z"),
    46244.625,
  );
  assert.equal(
    googleSheetsViewingSerial("2026-08-11T05:00:00.000Z"),
    46245.5,
  );
  assert.equal(formatSheetViewingTime("2026-08-10T08:00:00.000Z"), "10/08/2026 15:00");
  assert.equal(formatSheetViewingTime("2026-08-11T05:00:00.000Z"), "11/08/2026 12:00");
});

test("finds missing blank rows only between different viewing dates", () => {
  const day10Morning = googleSheetsViewingSerial("2026-08-10T01:00:00.000Z");
  const day10Evening = googleSheetsViewingSerial("2026-08-10T13:00:00.000Z");
  const day11 = googleSheetsViewingSerial("2026-08-11T05:00:00.000Z");

  assert.deepEqual(
    viewingDaySeparatorIndexes([[day10Morning], [day10Evening], [day11]]),
    [3],
  );
  assert.deepEqual(
    viewingDaySeparatorIndexes([[day10Morning], [], [day11]]),
    [],
  );
});

test("marks appointments under one hour as short notice", () => {
  const validation = validateSaleViewingInput({
    customerName: "",
    phone: "0912345678",
    viewingAddress: "25 Mỹ Đình",
    viewingAt: "2026-07-27T02:30:00.000Z",
  }, NOW);

  assert.equal(validation.value.customerName, "Khách 0912345678");
  assert.equal(validation.value.shortNoticeAppointment, true);
  assert.equal(validation.value.beforeStatus, "EMAIL_MODE=SHORT_NOTICE; BEFORE_SKIPPED");
  assert.equal(validation.value.afterStatus, "AFTER_PENDING");
  assert.match(validation.value.reminderMessage, /hỏi lại sau 2 tiếng/);
  assert.equal(isSaleViewingCreateRoute("/api/sales/viewings", "POST"), true);
  assert.equal(isSaleViewingCreateRoute("/api/sales/viewings", "GET"), false);
});

test("dashboard builds and routes the appointment assistant", async () => {
  const [assistant, build, router, worker, dashboardRender] = await Promise.all([
    readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewing-create.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/app-render.js", import.meta.url), "utf8"),
  ]);

  assert.match(assistant, /Hẹn khách xem phòng/);
  assert.match(assistant, /fetch\("\/api\/sales\/viewings"/);
  assert.match(build, /sale-appointment\.js/);
  assert.match(router, /handleSaleViewingCreate/);
  assert.match(worker, /APPOINTMENTS_SHEET_TITLE = "Appointments"/);
  assert.match(worker, /APPOINTMENTS_TIME_RANGE = "Appointments!D2:D"/);
  assert.match(worker, /EMAIL_MODE=NORMAL; BEFORE_PENDING/);
  assert.match(worker, /EMAIL_MODE=SHORT_NOTICE; BEFORE_SKIPPED/);
  assert.match(worker, /viewingSerial/);
  assert.match(worker, /insertDimension/);
  assert.match(worker, /startIndex: 1/);
  assert.match(worker, /sourceRow: 2/);
  assert.match(worker, /viewingDaySeparatorIndexes/);
  assert.doesNotMatch(worker, /:append\?/);
  assert.doesNotMatch(dashboardRender, /groupViewingsByDay/);
  assert.doesNotMatch(dashboardRender, /viewing-day-divider/);
  assert.match(dashboardRender, /formatViewingTime\(viewing\.viewingAt\)/);
});
